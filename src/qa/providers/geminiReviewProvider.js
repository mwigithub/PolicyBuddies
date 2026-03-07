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

function buildPrompt({ question, answer, evidence, confidenceScore }) {
  const evidencePreview = evidence
    .slice(0, 5)
    .map((item, index) => {
      const source = `${item.sourcePath} lines ${item.lineStart}-${item.lineEnd}`;
      const snippet = String(item.text ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500);
      return `[E${index + 1}] ${source}: ${snippet}`;
    })
    .join("\n");

  return [
    "You are a strict evidence reviewer for life insurance Q&A.",
    "Evaluate whether the answer is supported by evidence only.",
    "Return ONLY JSON with keys:",
    "status (sufficient|insufficient), confidenceScore (0..1), gaps (array of strings).",
    "No markdown.",
    "",
    `Question: ${question}`,
    `Answer: ${answer}`,
    `BaselineScore: ${confidenceScore}`,
    "",
    "Evidence:",
    evidencePreview || "No evidence.",
  ].join("\n");
}

export function createGeminiReviewProvider(config = {}) {
  const provider = config.provider ?? "gemini-review-provider";
  const model = config.model ?? "gemini-2.0-flash";
  const apiKeyEnv = config.apiKeyEnv ?? "GEMINI_API_KEY";
  const apiKey = process.env[apiKeyEnv] ?? "";
  const baseUrl =
    config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";

  return {
    provider,
    model,
    async review({ question, answer, evidence, confidenceScore }) {
      if (!apiKey) {
        throw new Error(`Missing API key in env ${apiKeyEnv}`);
      }

      const prompt = buildPrompt({ question, answer, evidence, confidenceScore });
      const response = await fetch(
        `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json",
            },
          }),
        },
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Gemini review request failed (${response.status}): ${body.slice(0, 180)}`,
        );
      }

      const payload = await response.json();
      const text =
        payload?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      const parsed = tryParseJson(text);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Gemini review returned invalid JSON payload");
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
