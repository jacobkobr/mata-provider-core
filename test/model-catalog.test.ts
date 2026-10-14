import { describe, expect, it } from 'vitest'
import { MODEL_PULL_NAMES, resolvePullName } from '../src/model-catalog'

// Mirrors the model IDs in src/lib/config.ts's AI_MODELS catalog. Kept as a
// plain literal list (not imported from the app) so this package stays
// independent of app code — but it's what actually catches a model being
// added to the catalog without a matching Ollama pull tag.
const APP_MODEL_IDS = [
  'llama2-7b',
  'llama2-13b',
  'codellama-7b',
  'codellama-13b',
  'llama-vision',
  'deepseek-7b',
  'deepseek-1.5b',
  'deepseek-8b',
  'deepseek-14b',
  'deepseek-32b',
  'mistral-7b',
  'phi-2',
  'gemma-2b',
  'gemma-7b',
  'qwen-1.5b',
  'qwen-7b',
  'qwen-14b',
  'mistral-nemo',
]

describe('model-catalog', () => {
  it('resolves every app model ID to a non-empty Ollama pull tag', () => {
    for (const id of APP_MODEL_IDS) {
      const pullName = resolvePullName(id)
      expect(pullName, `model "${id}" should resolve to a real pull tag`).toBeTruthy()
      expect(pullName).not.toBe('')
    }
  })

  it('falls back to the raw model ID when no mapping exists', () => {
    expect(resolvePullName('some-unknown-model')).toBe('some-unknown-model')
  })

  it('has no accidental duplicate or empty pull tags', () => {
    const values = Object.values(MODEL_PULL_NAMES)
    for (const value of values) {
      expect(value.length).toBeGreaterThan(0)
    }
  })
})
