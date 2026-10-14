// The single authoritative map from Mata's internal model IDs to the tag Ollama
// expects on `ollama pull`/the generate API. Previously duplicated (and out of
// sync) between config.ts and model-service.ts.
export const MODEL_PULL_NAMES: Record<string, string> = {
  'llama2-7b': 'llama2:7b',
  'llama2-13b': 'llama2:13b',
  'codellama-7b': 'codellama:7b',
  'codellama-13b': 'codellama:13b',
  'llama-vision': 'llama3.2-vision:11b',
  'deepseek-1.5b': 'deepseek-r1:1.5b',
  'deepseek-7b': 'deepseek-r1:7b',
  'deepseek-8b': 'deepseek-r1:8b',
  'deepseek-14b': 'deepseek-r1:14b',
  'deepseek-32b': 'deepseek-r1:32b',
  'mistral-7b': 'mistral:latest',
  'mistral-nemo': 'mistral-nemo:latest',
  'phi-2': 'phi:latest',
  'gemma-2b': 'gemma:2b',
  'gemma-7b': 'gemma:7b',
  'qwen-1.5b': 'qwen:1.5b',
  'qwen-7b': 'qwen:7b',
  'qwen-14b': 'qwen:14b',
}

export function resolvePullName(modelId: string): string {
  return MODEL_PULL_NAMES[modelId] ?? modelId
}
