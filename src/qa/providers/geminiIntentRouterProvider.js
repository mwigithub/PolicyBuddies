function extractJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return text.slice(start, end + 1);
}

function normalizeScopeHint(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw || raw === "none" || raw === "null") {
    return null;
  }
  return raw;
}

function buildPrompt(question) {
  return [
    "You classify user question intent for policy-document retrieval.",
    "Return strict JSON only. No markdown.",
    "Schema:",
    '{ "tableIntent": boolean, "formulaIntent": boolean, "metadataIntent": boolean, "scopeHint": string | null, "confidence": number }',
    "Rules:",
    "- tableIntent=true when user asks for table/row/column/projection schedule values.",
    "- formulaIntent=true when user asks for formula/calculation/rate/bonus computation/projection simulation.",
    "- metadataIntent=true when user asks eligibility/list/type/bonus/rider/benefit/exclusion/claims metadata.",
    '- scopeHint must be one of: "product summary", "policy illustration", "product brochure", "fact find", or null.',
    "- Use product summary for rider/exclusion/claims definitions unless question explicitly asks illustration values.",
    "- confidence must be 0 to 1.",
    "",
    `Question: ${question}`,
  ].join("\n");
}

export function createGeminiIntentRouterProvider(config = {}) {
  const provider = config.provider ?? "gemini-intent-router-provider";
  const model = config.model ?? "gemini-2.0-flash";
  const apiKeyEnv = config.apiKeyEnv ?? "GEMINI_API_KEY";
  const apiKey = process.env[apiKeyEnv] ?? "";
  const baseUrl =
    config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";

  return {
    provider,
    model,
    async routeIntent({ question }) {
      if (!apiKey) {
        throw new Error(`Missing API key in env ${apiKeyEnv}`);
      }

      const prompt = buildPrompt(question);
      const response = await fetch(
        `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0,
              responseMimeType: "application/json",
            },
          }),
        },
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Gemini intent routing failed (${response.status}): ${body.slice(0, 200)}`,
        );
      }

      const payload = await response.json();
      const output =
        payload?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      const jsonText = extractJsonObject(output) ?? output;
      const parsed = JSON.parse(jsonText);

      return {
        tableIntent: Boolean(parsed.tableIntent),
        formulaIntent: Boolean(parsed.formulaIntent),
        metadataIntent: Boolean(parsed.metadataIntent),
        scopeHint: normalizeScopeHint(parsed.scopeHint),
        confidence: Number.isFinite(Number(parsed.confidence))
          ? Math.max(0, Math.min(1, Number(parsed.confidence)))
          : 0.5,
        routeSource: "llm",
      };
    },
  };
}
