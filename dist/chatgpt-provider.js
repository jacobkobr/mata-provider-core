"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChatGPTProvider = createChatGPTProvider;
function buildInput(req) {
    return req.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }));
}
function sessionError(session) {
    if (session.error)
        return session.error.message;
    if (session.status === 'disconnected')
        return 'Sign in with ChatGPT to use your plan for this request.';
    if (session.status === 'reauth_required')
        return 'Your ChatGPT connection needs to be reauthorized. Sign in again.';
    if (session.status === 'connecting')
        return 'Still connecting to ChatGPT.';
    // status === 'connected' but sharing is false: signed in, but plan-sharing permission not granted.
    return "You're signed in, but ChatGPT plan sharing isn't enabled for this app yet. Enable it in your ChatGPT account settings.";
}
function createChatGPTProvider(bridge) {
    async function checkStatus() {
        const session = await bridge.getSession();
        if (session.status === 'connected' && session.sharing) {
            return { available: true };
        }
        return { available: false, error: sessionError(session) };
    }
    async function listModels() {
        const models = await bridge.listModels();
        return models.map((model) => ({ id: model.slug, name: model.displayName }));
    }
    async function* generate(req) {
        const status = await checkStatus();
        if (!status.available) {
            throw new Error(status.error);
        }
        const requestId = crypto.randomUUID();
        const queue = [];
        let resolveWaiter = null;
        let aborted = false;
        const unsubscribe = bridge.onStreamChunk((payload) => {
            if (payload.requestId !== requestId)
                return;
            queue.push(payload.delta);
            resolveWaiter?.();
            resolveWaiter = null;
        });
        const handleAbort = () => {
            aborted = true;
            bridge.cancelStream(requestId).catch(() => { });
            resolveWaiter?.();
            resolveWaiter = null;
        };
        req.signal?.addEventListener('abort', handleAbort);
        const responsePromise = bridge
            .streamResponse({
            requestId,
            model: req.model,
            input: buildInput(req),
            instructions: req.knowledgeContext ? `Important context about the user:\n${req.knowledgeContext}` : undefined,
        })
            .finally(() => unsubscribe());
        let done = false;
        let finalText = '';
        responsePromise.then((result) => {
            finalText = result.text;
            done = true;
            resolveWaiter?.();
            resolveWaiter = null;
        }, () => {
            // Surfaced via the awaited responsePromise below; just unblock the loop here.
            done = true;
            resolveWaiter?.();
            resolveWaiter = null;
        });
        try {
            while (!aborted && (!done || queue.length > 0)) {
                if (queue.length > 0) {
                    yield { text: queue.shift(), done: false };
                    continue;
                }
                await new Promise((resolve) => {
                    resolveWaiter = resolve;
                });
            }
            if (aborted) {
                // Matches the DOMException fetch itself throws on an aborted request, so
                // callers can handle both providers' cancellation the same way.
                throw new DOMException('The ChatGPT response was cancelled.', 'AbortError');
            }
            // Propagates a rejected streamResponse (e.g. sharing limit hit mid-stream).
            await responsePromise;
            yield { text: finalText, done: true };
        }
        finally {
            req.signal?.removeEventListener('abort', handleAbort);
            unsubscribe();
            if (!done) {
                bridge.cancelStream(requestId).catch(() => { });
            }
        }
    }
    return {
        id: 'chatgpt',
        checkStatus,
        listModels,
        generate,
    };
}
//# sourceMappingURL=chatgpt-provider.js.map