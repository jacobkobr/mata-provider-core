import type { Provider } from './types';
export interface ChatGPTSessionState {
    status: 'disconnected' | 'connecting' | 'connected' | 'reauth_required';
    sharing: boolean;
    error?: {
        message: string;
    };
}
export interface ChatGPTModelInfo {
    slug: string;
    displayName: string;
}
/**
 * The subset of a ChatGPT sign-in bridge this provider needs — deliberately narrow and
 * free of any vendor SDK types, so this package has no dependency on how a given app
 * implements Sign in with ChatGPT. The caller injects a bridge (e.g. an Electron IPC
 * wrapper) that structurally satisfies this interface.
 */
export interface ChatGPTBridge {
    getSession(): Promise<ChatGPTSessionState>;
    listModels(): Promise<ChatGPTModelInfo[]>;
    streamResponse(payload: {
        requestId: string;
        model: string;
        input: {
            role: 'user' | 'assistant';
            content: string;
        }[];
        instructions?: string;
    }): Promise<{
        text: string;
    }>;
    cancelStream(requestId: string): Promise<void>;
    onStreamChunk(callback: (payload: {
        requestId: string;
        delta: string;
    }) => void): () => void;
}
export declare function createChatGPTProvider(bridge: ChatGPTBridge): Provider;
//# sourceMappingURL=chatgpt-provider.d.ts.map