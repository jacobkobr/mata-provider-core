import type { GenerateChunk, GenerateRequest, ModelInfo, Provider, ProviderStatus } from './types'

export interface ChatGPTSessionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'reauth_required'
  sharing: boolean
  error?: { message: string }
}

export interface ChatGPTModelInfo {
  slug: string
  displayName: string
}

/**
 * The subset of a ChatGPT sign-in bridge this provider needs — deliberately narrow and
 * free of any vendor SDK types, so this package has no dependency on how a given app
 * implements Sign in with ChatGPT. The caller injects a bridge (e.g. an Electron IPC
 * wrapper) that structurally satisfies this interface.
 */
export interface ChatGPTBridge {
  getSession(): Promise<ChatGPTSessionState>
  listModels(): Promise<ChatGPTModelInfo[]>
  streamResponse(payload: {
    requestId: string
    model: string
    input: { role: 'user' | 'assistant'; content: string }[]
    instructions?: string
  }): Promise<{ text: string }>
  cancelStream(requestId: string): Promise<void>
  onStreamChunk(callback: (payload: { requestId: string; delta: string }) => void): () => void
}

function buildInput(req: GenerateRequest): { role: 'user' | 'assistant'; content: string }[] {
  return req.messages
    .filter((m): m is { role: 'user' | 'assistant'; content: string } => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }))
}

function sessionError(session: ChatGPTSessionState): string {
  if (session.error) return session.error.message
  if (session.status === 'disconnected') return 'Sign in with ChatGPT to use your plan for this request.'
  if (session.status === 'reauth_required') return 'Your ChatGPT connection needs to be reauthorized. Sign in again.'
  if (session.status === 'connecting') return 'Still connecting to ChatGPT.'
  // status === 'connected' but sharing is false: signed in, but plan-sharing permission not granted.
  return "You're signed in, but ChatGPT plan sharing isn't enabled for this app yet. Enable it in your ChatGPT account settings."
}

export function createChatGPTProvider(bridge: ChatGPTBridge): Provider {
  async function checkStatus(): Promise<ProviderStatus> {
    const session = await bridge.getSession()
    if (session.status === 'connected' && session.sharing) {
      return { available: true }
    }
    return { available: false, error: sessionError(session) }
  }

  async function listModels(): Promise<ModelInfo[]> {
    const models = await bridge.listModels()
    return models.map((model) => ({ id: model.slug, name: model.displayName }))
  }

  async function* generate(req: GenerateRequest): AsyncIterable<GenerateChunk> {
    const status = await checkStatus()
    if (!status.available) {
      throw new Error(status.error)
    }

    const requestId = crypto.randomUUID()
    const queue: string[] = []
    let resolveWaiter: (() => void) | null = null

    const unsubscribe = bridge.onStreamChunk((payload) => {
      if (payload.requestId !== requestId) return
      queue.push(payload.delta)
      resolveWaiter?.()
      resolveWaiter = null
    })

    const responsePromise = bridge
      .streamResponse({
        requestId,
        model: req.model,
        input: buildInput(req),
        instructions: req.knowledgeContext ? `Important context about the user:\n${req.knowledgeContext}` : undefined,
      })
      .finally(() => unsubscribe())

    let done = false
    let finalText = ''
    responsePromise.then((result) => {
      finalText = result.text
      done = true
      resolveWaiter?.()
      resolveWaiter = null
    }, () => {
      // Surfaced via the awaited responsePromise below; just unblock the loop here.
      done = true
      resolveWaiter?.()
      resolveWaiter = null
    })

    try {
      while (!done || queue.length > 0) {
        if (queue.length > 0) {
          yield { text: queue.shift()!, done: false }
          continue
        }
        await new Promise<void>((resolve) => {
          resolveWaiter = resolve
        })
      }
      // Propagates a rejected streamResponse (e.g. sharing limit hit mid-stream).
      await responsePromise
      yield { text: finalText, done: true }
    } finally {
      unsubscribe()
      if (!done) {
        bridge.cancelStream(requestId).catch(() => {})
      }
    }
  }

  return {
    id: 'chatgpt',
    checkStatus,
    listModels,
    generate,
  }
}
