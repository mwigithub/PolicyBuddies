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

export function createOllamaIntentRouterProvider(config = {}) {
  const provider = config.provider ?? "ollama-intent-router-provider";
  const model = config.model ?? "llama3.1:latest";
  const baseUrl = config.baseUrl ?? "http://127.0.0.1:11434";

  return {
    provider,
    model,
    async routeIntent({ question }) {
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
          `Ollama intent routing failed (${response.status}): ${body.slice(0, 200)}`,
        );
      }

      const payload = await response.json();
      const output = String(payload.response ?? "").trim();
      const jsonText = extractJsonObject(output);
      if (!jsonText) {
        throw new Error("Intent routing returned non-JSON response.");
      }

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
