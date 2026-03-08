/**
 * Gemini Embedding Provider
 *
 * Uses Google's text-embedding-004 model (768-dim) via HTTP.
 * No Python dependency — works in any environment with GEMINI_API_KEY.
 *
 * Interface: { name, model, embedText(text), embedBatch(texts) }
 */

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export function createGeminiEmbeddingProvider(config = {}) {
  const apiKey = config.apiKey ?? process.env.GEMINI_API_KEY;
  const model = config.model ?? "text-embedding-004";

  if (!apiKey) {
    throw new Error("[geminiEmbeddingProvider] GEMINI_API_KEY is required");
  }

  async function embedText(text) {
    const res = await fetch(
      `${BASE_URL}/models/${model}:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: `models/${model}`,
          content: { parts: [{ text }] },
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Gemini embedContent failed (${res.status}): ${body}`);
    }
    const data = await res.json();
    return data.embedding.values; // number[], length 768
  }

  async function embedBatch(texts) {
    if (texts.length === 0) return [];
    const res = await fetch(
      `${BASE_URL}/models/${model}:batchEmbedContents?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requests: texts.map((text) => ({
            model: `models/${model}`,
            content: { parts: [{ text }] },
          })),
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Gemini batchEmbedContents failed (${res.status}): ${body}`);
    }
    const data = await res.json();
    return data.embeddings.map((e) => e.values); // number[][], each length 768
  }

  return { name: "gemini-embedding-provider", model, embedText, embedBatch };
}
