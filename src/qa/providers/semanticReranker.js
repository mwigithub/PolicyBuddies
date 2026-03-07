import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const SCRIPT_PATH = resolve(process.cwd(), "scripts/semantic_embed.py");
const PYTHON_BIN = resolve(process.cwd(), ".venv/bin/python3");

export function createSemanticReranker(config = {}) {
  const model = config.model ?? "all-MiniLM-L6-v2";
  // Weight given to semantic score when blending with keyword score (0–1)
  const semanticWeight = config.semanticWeight ?? 0.6;

  return {
    /**
     * Reranks candidates by blending keyword scores with semantic similarity.
     * Returns the same array with updated `score`, plus `keywordScore` and `semanticScore`.
     * Falls back to original keyword scores if the Python call fails.
     */
    rerank(question, candidates) {
      if (candidates.length === 0) {
        return candidates;
      }

      try {
        const chunks = candidates.map((c) => c.text);
        const stdout = execFileSync(
          PYTHON_BIN,
          [
            SCRIPT_PATH,
            "rerank",
            "--question", question,
            "--chunks", JSON.stringify(chunks),
            "--model", model,
          ],
          {
            encoding: "utf8",
            maxBuffer: 10 * 1024 * 1024,
            timeout: 30000,
            stdio: ["ignore", "pipe", "pipe"],
          },
        );

        const result = JSON.parse(stdout.trim());
        if (!result.ok || !Array.isArray(result.scores)) {
          throw new Error(result.error ?? "invalid response from semantic_embed.py");
        }

        return candidates.map((candidate, i) => {
          const semanticScore = Number(result.scores[i] ?? 0);
          const blended = (1 - semanticWeight) * candidate.score + semanticWeight * semanticScore;
          return {
            ...candidate,
            keywordScore: candidate.score,
            semanticScore,
            score: Math.max(0, Math.min(1, Number(blended.toFixed(6)))),
          };
        });
      } catch (error) {
        console.warn(`[semanticReranker] Falling back to keyword scores: ${error.message}`);
        return candidates;
      }
    },
  };
}
