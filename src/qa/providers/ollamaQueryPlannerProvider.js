function extractJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return text.slice(start, end + 1);
}

function normalizeIntentClass(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  const supported = new Set([
    "structured_lookup",
    "calculation",
    "explanatory",
    "comparison",
    "definition",
  ]);
  if (!supported.has(raw)) {
    return null;
  }
  return raw;
}

function buildPrompt(question) {
  return [
    "You classify policy questions into exactly one intent class.",
    "Return strict JSON only. No markdown.",
    "Schema:",
    '{ "intentClass": "structured_lookup|calculation|explanatory|comparison|definition", "confidence": number }',
    "Rules:",
    "- structured_lookup: direct factual lookup from policy facts/terms/coverage/rider/exclusions/claims/surrender/premium details.",
    "- calculation: needs formula/math/projection/simulation (bonus, premium projection, illustrated rates).",
    "- explanatory: asks for explanation/narrative/why/how process.",
    "- comparison: asks to compare plans, scenarios, riders, projected outcomes.",
    "- definition: asks what a term means (e.g., sum assured, surrender value, TPD).",
    "- Insurance domain cues:",
    "  structured_lookup cues: benefit, rider, coverage, eligibility, exclusion, waiting period, claims, surrender value, death benefit, premium mode.",
    "  calculation cues: calculate, compute, formula, projected value, simulate, 4%/8% illustrated.",
    "- confidence must be 0 to 1.",
    "",
    `Question: ${question}`,
  ].join("\n");
}

export function createOllamaQueryPlannerProvider(config = {}) {
  const provider = config.provider ?? "ollama-query-planner-provider";
  const model = config.model ?? "llama3.1:latest";
  const baseUrl = config.baseUrl ?? "http://127.0.0.1:11434";

  return {
    provider,
    model,
    async classify({ question }) {
      const prompt = buildPrompt(question);
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: {
            temperature: 0,
          },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Ollama query planner failed (${response.status}): ${body.slice(0, 200)}`,
        );
      }

      const payload = await response.json();
      const output = String(payload.response ?? "").trim();
      const jsonText = extractJsonObject(output);
      if (!jsonText) {
        throw new Error("Query planner returned non-JSON response.");
      }

      const parsed = JSON.parse(jsonText);
      const intentClass = normalizeIntentClass(parsed.intentClass);
      if (!intentClass) {
        throw new Error("Query planner returned unsupported intentClass.");
      }
      const confidence = Number(parsed.confidence);
      return {
        intentClass,
        confidence: Number.isFinite(confidence)
          ? Math.max(0, Math.min(1, confidence))
          : 0.5,
      };
    },
  };
}
