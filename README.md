# @mata/provider-core

A small provider-routing core: one `Provider` interface (`checkStatus` / `listModels` /
`generate`) implemented by a local-model provider (Ollama) and a ChatGPT provider, so a
chat client can switch between a local model and a signed-in ChatGPT plan mid-conversation
without changing how it talks to either one.

Framework-agnostic — no React, Electron, or vendor SDK dependency. `createChatGPTProvider`
takes a small bridge interface the host app implements (e.g. an Electron IPC wrapper around
an OAuth/session SDK); this package never talks to OpenAI or Ollama's network APIs directly
except through `createOllamaProvider`'s plain `fetch` calls.

## Usage

```ts
import { createOllamaProvider, createChatGPTProvider } from '@mata/provider-core'

const ollama = createOllamaProvider()
const chatgpt = createChatGPTProvider(bridge) // bridge: ChatGPTBridge

for await (const chunk of ollama.generate({ model: 'llama2-7b', messages })) {
  // chunk.done === false: incremental delta to append
  // chunk.done === true: final, complete text — replace, don't append
}
```

## Development

```sh
npm install
npm run build       # compiles src/ -> dist/
npm run typecheck
npm test             # vitest
```
