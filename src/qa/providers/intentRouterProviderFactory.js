import { createGeminiIntentRouterProvider } from "./geminiIntentRouterProvider.js";
import { createOllamaIntentRouterProvider } from "./ollamaIntentRouterProvider.js";

export function createIntentRouterProvider(config = {}) {
  const provider = String(config.provider ?? "").toLowerCase();

  if (provider === "gemini-intent-router-provider") {
    return createGeminiIntentRouterProvider(config);
  }
  if (provider === "ollama-intent-router-provider") {
    return createOllamaIntentRouterProvider(config);
  }

  return {
    provider: provider || "disabled-intent-router-provider",
    model: config.model ?? "n/a",
    async routeIntent() {
      return {
        tableIntent: false,
        formulaIntent: false,
        metadataIntent: false,
        scopeHint: null,
        confidence: 0,
        routeSource: "disabled",
      };
    },
  };
}
