import { createGeminiConversationProvider } from "./geminiConversationProvider.js";
import { createOllamaConversationProvider } from "./ollamaConversationProvider.js";

export function createConversationLlmProvider(config = {}) {
  const provider = String(config.provider ?? "").toLowerCase();

  if (provider === "gemini-conversation-provider") {
    return createGeminiConversationProvider(config);
  }
  if (provider === "ollama-conversation-provider") {
    return createOllamaConversationProvider(config);
  }

  return {
    provider: provider || "disabled-conversation-provider",
    model: config.model ?? "n/a",
    async synthesizeAnswer() {
      return "information not found";
    },
  };
}
