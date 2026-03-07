import { createGeminiQueryPlannerProvider } from "./geminiQueryPlannerProvider.js";
import { createOllamaQueryPlannerProvider } from "./ollamaQueryPlannerProvider.js";

export function createQueryPlannerProvider(config = {}) {
  const provider = String(config.provider ?? "").toLowerCase();

  if (provider === "gemini-query-planner-provider") {
    return createGeminiQueryPlannerProvider(config);
  }
  if (provider === "ollama-query-planner-provider") {
    return createOllamaQueryPlannerProvider(config);
  }

  return {
    provider: provider || "disabled-query-planner-provider",
    model: config.model ?? "n/a",
    async classify() {
      return {
        intentClass: null,
        confidence: 0,
      };
    },
  };
}
