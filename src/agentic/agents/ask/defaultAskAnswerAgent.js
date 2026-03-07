function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function isMissingAnswer(text) {
  const value = normalize(text);
  return (
    value.length === 0 ||
    value.includes("llm synthesis failed") ||
    value.includes("information not found") ||
    value.includes("insufficient information") ||
    value.includes("to be defined")
  );
}

function wantsHybridContext(text) {
  return /\b(both|combine|with context|with example)\b/i.test(String(text ?? ""));
}

function detectOpenEndedIntent(result) {
  const intentClass = normalize(result?.queryPlan?.intentClass);
  return intentClass === "explanatory" || intentClass === "comparison";
}

function buildDeterministicSuggestions(question, result) {
  const text = normalize(question);
  const suggestions = [];

  if (/waiting period|deferment period/.test(text)) {
    suggestions.push(
      'Ask deterministic: "What is the waiting period for this rider in this policy?"',
    );
  }
  if (/sum assured|basic sum assured/.test(text)) {
    suggestions.push(
      'Ask deterministic: "What is the sum assured amount for this policy illustration?"',
    );
  }
  if (/bonus/.test(text)) {
    suggestions.push(
      'Ask deterministic: "Calculate loyalty bonus at policy year 10 with account value 100000."',
    );
  }
  if (/premium/.test(text) && /year/.test(text)) {
    suggestions.push(
      'Ask deterministic: "What is total premium paid at policy year 10?"',
    );
  }
  if (suggestions.length === 0) {
    suggestions.push(
      'Refine with policy context: "for this policy/product summary/policy illustration".',
    );
    suggestions.push(
      'Add structured inputs: policy year, scenario (guaranteed/illustrated), and benefit type.',
    );
  }

  if (!result?.intentRouting?.scopeHint) {
    suggestions.push(
      'Add target scope for deterministic retrieval: "use product summary" or "use policy illustration".',
    );
  }

  return suggestions.slice(0, 3);
}

export function createDefaultAskAnswerAgent() {
  return {
    name() {
      return "default-ask-answer-agent";
    },
    capabilities() {
      return ["candidate-preparation", "initial-composition"];
    },
    execute({ question, result, llmAnswer }) {
      const deterministicCandidate = String(result?.answer ?? "").trim();
      const industryCandidate = String(
        result?.industryDefinitionAnswer ?? llmAnswer ?? "",
      ).trim();
      const deterministicAvailable = !isMissingAnswer(deterministicCandidate);
      const industryAvailable = !isMissingAnswer(industryCandidate);
      const sourcePreference = normalize(result?.answerSourcePreference);
      const wantsHybrid = wantsHybridContext(question);
      const openEndedIntent = detectOpenEndedIntent(result);
      const deterministicSuggestions = openEndedIntent
        ? buildDeterministicSuggestions(question, result)
        : [];

      if (wantsHybrid && deterministicAvailable && industryAvailable) {
        return {
          preparedAnswer: {
            decision: "hybrid",
            selectedSource: "hybrid",
            selectedAnswer: [
              "Industry Context:",
              industryCandidate,
              "",
              "Policy Context:",
              deterministicCandidate,
            ].join("\n"),
            candidates: {
              deterministicCandidate,
              industryCandidate,
              deterministicAvailable,
              industryAvailable,
            },
            openEndedIntent,
            deterministicSuggestions,
          },
        };
      }

      if (sourcePreference === "industry" && industryAvailable) {
        return {
          preparedAnswer: {
            decision: "industry_only",
            selectedSource: "industry",
            selectedAnswer: industryCandidate,
            candidates: {
              deterministicCandidate,
              industryCandidate,
              deterministicAvailable,
              industryAvailable,
            },
            openEndedIntent,
            deterministicSuggestions,
          },
        };
      }

      if (deterministicAvailable) {
        return {
          preparedAnswer: {
            decision: "deterministic_only",
            selectedSource: "evidence",
            selectedAnswer: deterministicCandidate,
            candidates: {
              deterministicCandidate,
              industryCandidate,
              deterministicAvailable,
              industryAvailable,
            },
            openEndedIntent,
            deterministicSuggestions,
          },
        };
      }

      if (industryAvailable) {
        return {
          preparedAnswer: {
            decision: "industry_only",
            selectedSource: "industry",
            selectedAnswer: industryCandidate,
            candidates: {
              deterministicCandidate,
              industryCandidate,
              deterministicAvailable,
              industryAvailable,
            },
            openEndedIntent,
            deterministicSuggestions,
          },
        };
      }

      return {
        preparedAnswer: {
          decision: "no_answer",
          selectedSource: "none",
          selectedAnswer:
            "Direct Answer: information not found in model and retrieved evidence for this question.",
          candidates: {
            deterministicCandidate,
            industryCandidate,
            deterministicAvailable,
            industryAvailable,
          },
          openEndedIntent,
          deterministicSuggestions,
        },
      };
    },
  };
}
