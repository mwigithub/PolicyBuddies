function compact(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPrompt({ question, evidence }) {
  const evidenceLines = evidence
    .slice(0, 6)
    .map((item, index) => {
      const source = `${item.sourcePath} lines ${item.lineStart}-${item.lineEnd}`;
      const snippet = compact(item.text).slice(0, 700);
      return `[E${index + 1}] ${source}\n${snippet}`;
    })
    .join("\n\n");

  return [
    "You are a policy assistant. Synthesize an answer from evidence only.",
    "Return plain text with sections:",
    "Direct Answer:",
    "Evidence Highlights:",
    "Do not invent facts. If uncertain, state that clearly.",
    "",
    `Question: ${question}`,
    "",
    "Evidence:",
    evidenceLines || "No evidence available.",
  ].join("\n");
}

export function createGeminiConversationProvider(config = {}) {
  const provider = config.provider ?? "gemini-conversation-provider";
  const model = config.model ?? "gemini-2.0-flash";
  const apiKeyEnv = config.apiKeyEnv ?? "GEMINI_API_KEY";
  const apiKey = process.env[apiKeyEnv] ?? "";
  const baseUrl =
    config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";

  return {
    provider,
    model,
    async synthesizeAnswer({ question, evidence }) {
      if (!apiKey) {
        throw new Error(`Missing API key in env ${apiKeyEnv}`);
      }

      const prompt = buildPrompt({ question, evidence });
      const response = await fetch(
        `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
            },
          }),
        },
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Gemini synthesis request failed (${response.status}): ${body.slice(0, 200)}`,
        );
      }

      const payload = await response.json();
      const output =
        payload?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      return output || "information not found";
    },
  };
}
