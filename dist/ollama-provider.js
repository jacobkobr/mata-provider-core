"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOllamaProvider = createOllamaProvider;
const model_catalog_1 = require("./model-catalog");
const DEFAULT_BASE_URL = 'http://localhost:11434';
const BASE_SYSTEM_PROMPT = `You are a helpful AI assistant. Be direct and concise in your responses. Stay focused on the user's questions and provide accurate, relevant answers.`;
function formatHistory(messages) {
    return messages
        .map((msg) => {
        if (msg.role === 'user')
            return `Human: ${msg.content}`;
        if (msg.role === 'assistant') {
            // Strip any prior <think> blocks so they don't pollute the context sent back to the model.
            const cleanContent = msg.content.replace(/<think>[^]*?<\/think>/, '').trim();
            return `Assistant: ${cleanContent}`;
        }
        return '';
    })
        .filter(Boolean)
        .join('\n');
}
function buildPrompt(req) {
    const lastMessage = req.messages[req.messages.length - 1];
    const history = formatHistory(req.messages.slice(0, -1));
    const systemPrompt = `${BASE_SYSTEM_PROMPT}
${req.knowledgeContext ? `\nImportant context about me:\n${req.knowledgeContext}\n` : ''}
Before responding, briefly show your thinking process inside <think></think> tags.

For example:
Human: What's 2+2?
Assistant: <think>This is a basic arithmetic question. The sum of 2 and 2 is 4.</think>
4`;
    return `${systemPrompt}\n\n${history}\n\nHuman: ${lastMessage.content}\n\nAssistant:`;
}
function createOllamaProvider(options = {}) {
    const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    async function checkStatus() {
        try {
            const response = await fetch(`${baseUrl}/api/version`, {
                method: 'GET',
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) {
                return { available: false, error: `Ollama service returned error ${response.status}: ${response.statusText}` };
            }
            return { available: true };
        }
        catch (error) {
            return {
                available: false,
                error: error instanceof Error
                    ? `Could not connect to Ollama: ${error.message}`
                    : 'Could not connect to Ollama. Make sure it is installed and running: "ollama serve"',
            };
        }
    }
    async function listModels() {
        const response = await fetch(`${baseUrl}/api/tags`);
        if (!response.ok)
            return [];
        const data = (await response.json());
        const models = data.models ?? [];
        return models.map((model) => ({ id: model.name, name: model.name }));
    }
    async function* generate(req) {
        const status = await checkStatus();
        if (!status.available) {
            throw new Error(status.error);
        }
        const response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: req.signal,
            body: JSON.stringify({
                model: (0, model_catalog_1.resolvePullName)(req.model),
                prompt: buildPrompt(req),
                stream: true,
                options: {
                    temperature: req.temperature,
                    num_predict: req.maxTokens,
                },
                images: req.images ? [req.images.content] : undefined,
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to generate response from Ollama: ${error}`);
        }
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('Failed to get response reader');
        }
        let fullResponse = '';
        let buffer = '';
        const decoder = new TextDecoder();
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.trim())
                        continue;
                    try {
                        const data = JSON.parse(line);
                        if (data.response) {
                            fullResponse += data.response;
                            yield { text: data.response, done: false };
                        }
                    }
                    catch {
                        // Malformed line in the NDJSON stream — skip it and keep going.
                    }
                }
            }
            if (buffer.trim()) {
                try {
                    const data = JSON.parse(buffer);
                    if (data.response) {
                        fullResponse += data.response;
                        yield { text: data.response, done: false };
                    }
                }
                catch {
                    // Malformed trailing buffer — nothing more to recover here.
                }
            }
        }
        finally {
            reader.releaseLock();
        }
        if (!fullResponse) {
            throw new Error('Invalid response format from Ollama');
        }
        const cleanResponse = fullResponse.trim().replace(/^Assistant:\s*/i, '');
        yield { text: cleanResponse, done: true };
    }
    return {
        id: 'ollama',
        checkStatus,
        listModels,
        generate,
    };
}
//# sourceMappingURL=ollama-provider.js.map