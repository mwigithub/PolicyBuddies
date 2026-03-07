import { createGeminiReviewProvider } from "./geminiReviewProvider.js";
import { createOllamaReviewProvider } from "./ollamaReviewProvider.js";

export function createReviewProvider(config = {}) {
  const provider = String(config.provider ?? "").toLowerCase();

  if (provider === "gemini-review-provider") {
    return createGeminiReviewProvider(config);
  }
  if (provider === "ollama-review-provider") {
    return createOllamaReviewProvider(config);
  }

  return null;
}
