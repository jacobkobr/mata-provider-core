export interface ProviderStatus {
    available: boolean;
    error?: string;
}
export interface ModelInfo {
    id: string;
    name: string;
}
export interface GenerateMessage {
    role: 'user' | 'assistant' | 'error';
    content: string;
}
export interface GenerateRequest {
    model: string;
    messages: GenerateMessage[];
    images?: {
        content: string;
        type: string;
    };
    temperature?: number;
    maxTokens?: number;
    /** Enabled "model knowledge" snippets from app settings, injected into the system prompt. */
    knowledgeContext?: string;
    signal?: AbortSignal;
}
/**
 * While done is false, text is an incremental delta to append to the in-progress
 * message. The final chunk has done: true and text is the complete, cleaned
 * response — callers should replace (not append) on that chunk.
 */
export interface GenerateChunk {
    text: string;
    done: boolean;
}
export interface Provider {
    id: string;
    checkStatus(): Promise<ProviderStatus>;
    listModels(): Promise<ModelInfo[]>;
    generate(req: GenerateRequest): AsyncIterable<GenerateChunk>;
    embed?(text: string): Promise<number[]>;
}
//# sourceMappingURL=types.d.ts.map