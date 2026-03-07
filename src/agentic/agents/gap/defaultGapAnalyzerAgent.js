function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function mentionsMathIntent(text) {
  return /\bcalculate|calculation|compute|computed|total bonus|bonus eligible|eligibl/i.test(
    text,
  );
}

function hasTotalBonusIntent(text) {
  return /\btotal bonus\b/i.test(text) && /\beligible|calculate|compute|computation\b/i.test(text);
}

function hasPolicyYear(text) {
  return /\b(\d{1,2})(?:st|nd|rd|th)\s+year\b/i.test(text) || /\byear\D{0,6}\d{1,2}\b/i.test(text);
}

function hasAccountValue(text) {
  return /(?:account value|amount|initial units account value|accumulation units account value)\D*[\d,]+(?:\.\d+)?/i
    .test(text);
}

function hasBonusScope(text) {
  return /\ball bonuses|all eligible bonuses|loyalty bonus|performance (?:investment )?bonus|power-?up bonus|initial bonus\b/i
    .test(text);
}

function hasScenarioBasis(text) {
  return /\billustrated|guaranteed|both\b/i.test(text);
}

function wantsAmount(result) {
  const text = normalize(result?.answer);
  return text.includes("requires an input amount");
}

function hasInsufficientEvidence(result) {
  const text = normalize(result?.answer);
  if (
    /insufficient information|does not contain sufficient information|not enough information|unable to determine|cannot determine|unable to calculate|cannot calculate/.test(
      text,
    )
  ) {
    return true;
  }
  return (result?.reviewGaps ?? []).some((gap) => {
    const normalized = normalize(gap);
    if (normalized.includes("gemini review fallback")) {
      return false;
    }
    return /insufficient|missing|not found|unable|cannot|lack/.test(normalized);
  });
}

function hasNoEvidence(result) {
  return Array.isArray(result?.citations) && result.citations.length === 0;
}

function hasInformationNotFound(result) {
  const text = normalize(result?.answer);
  return text.includes("information not found") || text.includes("to be defined");
}

function hasAnswerableEvidence(result) {
  const hasCitations = Array.isArray(result?.citations) && result.citations.length > 0;
  const status = normalize(result?.reviewStatus);
  return hasCitations && status === "sufficient" && !hasInformationNotFound(result);
}

export function createDefaultGapAnalyzerAgent() {
  return {
    name() {
      return "default-gap-analyzer-agent";
    },
    capabilities() {
      return ["gap-detection", "clarification-question"];
    },
    execute({
      latestResult,
      askedQuestions,
      originalQuestion,
      clarificationAnswers,
    }) {
      const asked = new Set((askedQuestions ?? []).map((item) => normalize(item)));
      const original = String(originalQuestion ?? "");
      const context = `${original}\n${(clarificationAnswers ?? []).join("\n")}`;
      if (hasAnswerableEvidence(latestResult) && !hasTotalBonusIntent(context)) {
        return {
          missingFields: [],
          gapSeverity: "none",
          nextBestQuestion: null,
        };
      }

      const candidates = [];
      if (hasTotalBonusIntent(context)) {
        if (!hasPolicyYear(context)) {
          candidates.push("Please provide the target policy year (for example: 10th year).");
        }
        if (!hasAccountValue(context)) {
          candidates.push(
            "Please provide the account value amount to use for computation (for example: account value 100000).",
          );
        }
        if (!hasBonusScope(context)) {
          candidates.push(
            "Please confirm bonus scope: all eligible bonuses, or specific types (loyalty/performance/power-up/initial).",
          );
        }
        if (!hasScenarioBasis(context)) {
          candidates.push(
            "Please confirm scenario basis: illustrated, guaranteed, or both.",
          );
        }
      }
      if (wantsAmount(latestResult)) {
        candidates.push(
          "Please provide the input amount to compute this (for example account value 100000).",
        );
      }
      if (
        hasInsufficientEvidence(latestResult) &&
        mentionsMathIntent(`${original}\n${latestResult?.answer ?? ""}`)
      ) {
        candidates.push(
          "To compute this correctly, please provide the missing numeric inputs and assumptions: account value (or initial units value), target policy year, and which bonus type(s) to include.",
        );
      }
      if (hasNoEvidence(latestResult)) {
        candidates.push(
          "Please specify product name and version label so I can narrow retrieval.",
        );
      }
      if (hasInsufficientEvidence(latestResult)) {
        candidates.push(
          "Please confirm which source basis to use for this answer: illustrated scenario, guaranteed scenario, or both.",
        );
      }

      const nextBestQuestion = candidates.find((item) => !asked.has(normalize(item))) ?? null;
      return {
        missingFields: [],
        gapSeverity: nextBestQuestion ? "critical" : "none",
        nextBestQuestion,
      };
    },
    health() {
      return { status: "ok", details: "heuristic gap analyzer" };
    },
  };
}
