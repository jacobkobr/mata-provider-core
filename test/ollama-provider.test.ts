import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOllamaProvider } from '../src/ollama-provider'

function ndjsonStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line + '\n'))
      }
      controller.close()
    },
  })
}

describe('OllamaProvider', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports unavailable with a clear message when Ollama is unreachable', async () => {
    fetchMock.mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
    const provider = createOllamaProvider()

    const status = await provider.checkStatus()

    expect(status.available).toBe(false)
    expect(status.error).toContain('Could not connect to Ollama')
  })

  it('reports available when the version endpoint responds ok', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true })
    const provider = createOllamaProvider()

    const status = await provider.checkStatus()

    expect(status).toEqual({ available: true })
  })

  it('streams incremental chunks and a final replace-chunk with the cleaned response', async () => {
    // First call: checkStatus's /api/version probe inside generate().
    fetchMock.mockResolvedValueOnce({ ok: true })
    // Second call: the actual /api/generate streaming request.
    fetchMock.mockResolvedValueOnce({
      ok: true,
      body: ndjsonStream([
        JSON.stringify({ response: 'Hello' }),
        JSON.stringify({ response: ' world' }),
        JSON.stringify({ done: true }),
      ]),
    })

    const provider = createOllamaProvider({ baseUrl: 'http://localhost:11434' })
    const chunks = []
    for await (const chunk of provider.generate({ model: 'llama2-7b', messages: [{ role: 'user', content: 'hi' }] })) {
      chunks.push(chunk)
    }

    expect(chunks.slice(0, -1)).toEqual([
      { text: 'Hello', done: false },
      { text: ' world', done: false },
    ])
    const final = chunks[chunks.length - 1]
    expect(final.done).toBe(true)
    expect(final.text).toBe('Hello world')

    // The generate call should have resolved the model ID to its real Ollama pull tag.
    const generateCall = fetchMock.mock.calls[1]
    const body = JSON.parse(generateCall[1].body)
    expect(body.model).toBe('llama2:7b')
  })

  it('throws when Ollama is unreachable before streaming starts', async () => {
    fetchMock.mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
    const provider = createOllamaProvider()

    const iterate = async () => {
      for await (const _ of provider.generate({ model: 'llama2-7b', messages: [{ role: 'user', content: 'hi' }] })) {
        // no-op
      }
    }

    await expect(iterate()).rejects.toThrow('Could not connect to Ollama')
  })
})
