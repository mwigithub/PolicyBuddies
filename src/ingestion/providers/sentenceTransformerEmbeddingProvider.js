import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const SCRIPT_PATH = resolve(process.cwd(), "scripts/semantic_embed.py");
const PYTHON_BIN = resolve(process.cwd(), ".venv/bin/python3");

function runScript(args, timeoutMs = 60000) {
  const stdout = execFileSync(PYTHON_BIN, [SCRIPT_PATH, ...args], {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    timeout: timeoutMs,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const result = JSON.parse(stdout.trim());
  if (!result.ok) {
    throw new Error(`semantic_embed.py error: ${result.error}`);
  }
  return result;
}

export function createSentenceTransformerEmbeddingProvider(config = {}) {
  const model = config.model ?? "all-MiniLM-L6-v2";

  return {
    name: "sentence-transformer-embedding-provider",
    model,

    // Embed a single text — used as fallback by ingestionService if embedBatch not called
    embedText(text) {
      const result = runScript([
        "embed-batch",
        "--texts", JSON.stringify([text]),
        "--model", model,
      ]);
      return result.embeddings[0];
    },

    // Embed all texts in a single Python call — much faster for ingestion
    embedBatch(texts) {
      if (texts.length === 0) {
        return [];
      }
      const result = runScript([
        "embed-batch",
        "--texts", JSON.stringify(texts),
        "--model", model,
      ]);
      return result.embeddings;
    },
  };
}
