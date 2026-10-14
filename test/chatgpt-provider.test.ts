import { describe, expect, it, vi } from 'vitest'
import { createChatGPTProvider, type ChatGPTBridge } from '../src/chatgpt-provider'

function fakeBridge(overrides: Partial<ChatGPTBridge> = {}): ChatGPTBridge {
  return {
    signIn: vi.fn(),
    cancelSignIn: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn().mockResolvedValue({ status: 'connected', sharing: true }),
    listProfiles: vi.fn(),
    selectProfile: vi.fn(),
    listModels: vi.fn().mockResolvedValue([{ slug: 'gpt-5', displayName: 'GPT-5' }]),
    streamResponse: vi.fn(),
    cancelStream: vi.fn().mockResolvedValue(undefined),
    onSessionChanged: vi.fn(() => () => {}),
    onStreamChunk: vi.fn(() => () => {}),
    ...overrides,
  }
}

describe('ChatGPTProvider', () => {
  it('reports available only when connected and sharing is enabled', async () => {
    const connected = createChatGPTProvider(fakeBridge())
    await expect(connected.checkStatus()).resolves.toEqual({ available: true })

    const notSharing = createChatGPTProvider(
      fakeBridge({ getSession: vi.fn().mockResolvedValue({ status: 'connected', sharing: false }) })
    )
    const status = await notSharing.checkStatus()
    expect(status.available).toBe(false)
    expect(status.error).toContain('sharing')
  })

  it('maps ChatGPT models to the generic ModelInfo shape', async () => {
    const provider = createChatGPTProvider(fakeBridge())
    await expect(provider.listModels()).resolves.toEqual([{ id: 'gpt-5', name: 'GPT-5' }])
  })

  it('streams deltas then a final replace-chunk with the complete text', async () => {
    let chunkCallback: ((payload: { requestId: string; delta: string }) => void) | undefined

    const bridge = fakeBridge({
      onStreamChunk: vi.fn((callback) => {
        chunkCallback = callback
        return () => {}
      }),
      streamResponse: vi.fn(async ({ requestId }) => {
        chunkCallback?.({ requestId, delta: 'Hello' })
        chunkCallback?.({ requestId, delta: ' world' })
        return { text: 'Hello world' }
      }),
    })

    const provider = createChatGPTProvider(bridge)
    const chunks = []
    for await (const chunk of provider.generate({ model: 'gpt-5', messages: [{ role: 'user', content: 'hi' }] })) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual([
      { text: 'Hello', done: false },
      { text: ' world', done: false },
      { text: 'Hello world', done: true },
    ])
  })

  it('throws before streaming when not signed in', async () => {
    const provider = createChatGPTProvider(
      fakeBridge({ getSession: vi.fn().mockResolvedValue({ status: 'disconnected', sharing: false }) })
    )

    const iterate = async () => {
      for await (const _ of provider.generate({ model: 'gpt-5', messages: [{ role: 'user', content: 'hi' }] })) {
        // no-op
      }
    }

    await expect(iterate()).rejects.toThrow(/Sign in with ChatGPT/)
  })

  it('stops and calls cancelStream when the signal is aborted mid-stream', async () => {
    const bridge = fakeBridge({
      streamResponse: vi.fn(() => new Promise(() => {})), // never resolves on its own
    })
    const provider = createChatGPTProvider(bridge)
    const controller = new AbortController()

    const iterate = async () => {
      for await (const _ of provider.generate({
        model: 'gpt-5',
        messages: [{ role: 'user', content: 'hi' }],
        signal: controller.signal,
      })) {
        // no-op
      }
    }

    const pending = iterate()
    // Let the generator reach its awaiting state (registered listener, in-flight
    // streamResponse call) before aborting, same as a real UI click mid-stream.
    await new Promise((resolve) => setTimeout(resolve, 0))
    controller.abort()

    await expect(pending).rejects.toThrow(/cancelled/i)
    expect(bridge.cancelStream).toHaveBeenCalled()
  })
})
