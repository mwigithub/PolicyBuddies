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
  const model = config.model ?? "gemini-embedding-001";
  const outputDimensionality = config.outputDimensionality ?? null;

  if (!apiKey) {
    throw new Error("[geminiEmbeddingProvider] GEMINI_API_KEY is required");
  }

  async function embedText(text) {
    const body = {
      model: `models/${model}`,
      content: { parts: [{ text }] },
    };
    if (outputDimensionality) body.outputDimensionality = outputDimensionality;
    const res = await fetch(
      `${BASE_URL}/models/${model}:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
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
    // Use parallel embedContent calls — batchEmbedContents is not supported
    // for text-embedding-004 on all API keys. Parallel calls are equally fast
    // for typical document chunk counts.
    return Promise.all(texts.map((text) => embedText(text)));
  }

  return { name: "gemini-embedding-provider", model, embedText, embedBatch };
}
