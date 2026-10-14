"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChatGPTProvider = exports.createOllamaProvider = exports.resolvePullName = exports.MODEL_PULL_NAMES = void 0;
__exportStar(require("./types"), exports);
var model_catalog_1 = require("./model-catalog");
Object.defineProperty(exports, "MODEL_PULL_NAMES", { enumerable: true, get: function () { return model_catalog_1.MODEL_PULL_NAMES; } });
Object.defineProperty(exports, "resolvePullName", { enumerable: true, get: function () { return model_catalog_1.resolvePullName; } });
var ollama_provider_1 = require("./ollama-provider");
Object.defineProperty(exports, "createOllamaProvider", { enumerable: true, get: function () { return ollama_provider_1.createOllamaProvider; } });
var chatgpt_provider_1 = require("./chatgpt-provider");
Object.defineProperty(exports, "createChatGPTProvider", { enumerable: true, get: function () { return chatgpt_provider_1.createChatGPTProvider; } });
//# sourceMappingURL=index.js.map