import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const SCRIPT_PATH = resolve(process.cwd(), "scripts/semantic_embed.py");
const PYTHON_BIN = resolve(process.cwd(), ".venv/bin/python3");

// Pass large payloads via stdin to avoid E2BIG (arg list too long) on big documents
function runScript(modeArgs, stdinData, timeoutMs = 120000) {
  const stdout = execFileSync(PYTHON_BIN, [SCRIPT_PATH, ...modeArgs], {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    timeout: timeoutMs,
    input: stdinData,
  });
  const lines = stdout.split("\n").filter((l) => l.trim());
  const result = JSON.parse(lines[lines.length - 1]);
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

    embedText(text) {
      const result = runScript(["embed-batch", "--model", model], JSON.stringify([text]));
      return result.embeddings[0];
    },

    embedBatch(texts) {
      if (texts.length === 0) return [];
      const result = runScript(["embed-batch", "--model", model], JSON.stringify(texts));
      return result.embeddings;
    },
  };
}
