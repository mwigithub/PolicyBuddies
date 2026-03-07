import { execFileSync } from "node:child_process";
import { sha256 } from "../utils.js";

function hashFallbackEmbedding(text, dims = 16) {
  const hashHex = sha256(text);
  const values = [];

  for (let i = 0; i < dims; i += 1) {
    const offset = (i * 2) % hashHex.length;
    const byteHex = hashHex.slice(offset, offset + 2);
    const value = parseInt(byteHex, 16);
    values.push(Number((value / 255).toFixed(6)));
  }

  return values;
}

export function createDefaultEmbeddingProvider(config = {}) {
  const providerName = config.provider ?? "default-embedding-provider";
  const modelName = config.model ?? "nomic-embed-text";
  const ollamaBaseUrl = config.baseUrl ?? "http://127.0.0.1:11434";

  return {
    name: providerName,
    model: modelName,
    embedText(text, dims = 16) {
      try {
        const payload = JSON.stringify({
          model: modelName,
          prompt: text,
        });
        const stdout = execFileSync(
          "curl",
          [
            "-sS",
            `${ollamaBaseUrl}/api/embeddings`,
            "-H",
            "content-type: application/json",
            "-d",
            payload,
          ],
          {
            encoding: "utf8",
            maxBuffer: 10 * 1024 * 1024,
            timeout: 5000,
            stdio: ["ignore", "pipe", "ignore"],
          },
        );

        const parsed = JSON.parse(stdout);
        if (Array.isArray(parsed.embedding) && parsed.embedding.length > 0) {
          return parsed.embedding;
        }

        console.warn(`[embedding] Ollama returned no embedding for model "${modelName}", using hash fallback.`);
        return hashFallbackEmbedding(text, dims);
      } catch (error) {
        console.warn(`[embedding] Ollama unavailable (${error instanceof Error ? error.message : String(error)}), using hash fallback.`);
        return hashFallbackEmbedding(text, dims);
      }
    },
  };
}
