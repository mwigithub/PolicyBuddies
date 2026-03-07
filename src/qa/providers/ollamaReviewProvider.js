import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

function toBand(score) {
  if (score >= 0.6) {
    return "high";
  }
  if (score >= 0.3) {
    return "medium";
  }
  return "low";
}

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.min(Math.max(num, 0), 1);
}

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function compact(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPrompt({
  answer,
  evidence,
  confidenceScore,
  independentFromIntent = true,
  question = "",
}) {
  const evidencePreview = evidence
    .slice(0, 5)
    .map((item, index) => {
      const source = `${item.sourcePath} lines ${item.lineStart}-${item.lineEnd}`;
      const snippet = compact(item.text).slice(0, 500);
      return `[E${index + 1}] ${source}: ${snippet}`;
    })
    .join("\n");

  const header = [
    "You are an independent evidence reviewer for insurance Q&A.",
    "Evaluate support quality using only provided Answer and Evidence.",
    "Do not infer missing facts. Do not rewrite the answer.",
    "Return ONLY JSON with keys:",
    "status (sufficient|insufficient), confidenceScore (0..1), gaps (array of strings).",
    "No markdown.",
  ];

  if (!independentFromIntent) {
    header.push(`Question Context: ${question}`);
  } else {
    header.push(
      "Question context is intentionally omitted to avoid intent contamination.",
    );
  }

  return [
    ...header,
    "",
    `Answer: ${answer}`,
    `BaselineScore: ${confidenceScore}`,
    "",
    "Evidence:",
    evidencePreview || "No evidence.",
  ].join("\n");
}

export function createOllamaReviewProvider(config = {}) {
  const provider = config.provider ?? "ollama-review-provider";
  const model = config.model ?? "llama3-lowram:latest";
  const baseUrl = config.baseUrl ?? "http://127.0.0.1:11434";
  const independentFromIntent = config.independentFromIntent !== false;
  const debug = config.debug === true;
  const debugLogPath = resolve(
    process.cwd(),
    config.debugLogPath ?? "logs/ollama-review.log",
  );

  const writeDebug = (title, payload) => {
    if (!debug) {
      return;
    }
    mkdirSync(dirname(debugLogPath), { recursive: true });
    const stamp = new Date().toISOString();
    appendFileSync(
      debugLogPath,
      `[${stamp}] ${title}\n${payload}\n\n`,
      "utf8",
    );
  };

  return {
    provider,
    model,
    async review({ question, answer, evidence, confidenceScore }) {
      const prompt = buildPrompt({
        question,
        answer,
        evidence,
        confidenceScore,
        independentFromIntent,
      });
      writeDebug("REQUEST_PROMPT", prompt);
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: {
            temperature: 0.1,
          },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Ollama review request failed (${response.status}): ${body.slice(0, 200)}`,
        );
      }

      const payload = await response.json();
      const text = String(payload?.response ?? "").trim();
      writeDebug("RESPONSE_RAW", text);
      const parsed = tryParseJson(text);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Ollama review returned invalid JSON payload");
      }

      const score = safeNumber(parsed.confidenceScore, confidenceScore);
      const gaps = Array.isArray(parsed.gaps)
        ? parsed.gaps.map((item) => String(item))
        : [];
      const status = String(parsed.status || "").toLowerCase() === "sufficient"
        ? "sufficient"
        : "insufficient";

      return {
        status,
        confidenceScore: score,
        confidenceBand: toBand(score),
        gaps,
      };
    },
  };
}
