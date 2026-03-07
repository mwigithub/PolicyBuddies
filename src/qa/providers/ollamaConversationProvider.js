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

export function createOllamaConversationProvider(config = {}) {
  const provider = config.provider ?? "ollama-conversation-provider";
  const model = config.model ?? "llama3.1:latest";
  const baseUrl = config.baseUrl ?? "http://127.0.0.1:11434";

  return {
    provider,
    model,
    async synthesizeAnswer({ question, evidence }) {
      const prompt = buildPrompt({ question, evidence });
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
          `Ollama synthesis request failed (${response.status}): ${body.slice(0, 200)}`,
        );
      }

      const payload = await response.json();
      const output = String(payload.response ?? "").trim();
      return output || "information not found";
    },
  };
}
