function toBand(score) {
  if (score >= 0.6) {
    return "high";
  }
  if (score >= 0.3) {
    return "medium";
  }
  return "low";
}

function hasInsufficientSignal(answer) {
  const text = String(answer ?? "").trim().toLowerCase();
  return /insufficient information|not enough information|unable to determine|cannot determine|unable to calculate|cannot calculate|information not found|to be defined/.test(
    text,
  );
}

export function createDefaultReviewProvider(config = {}) {
  const provider = config.provider ?? "default-review-provider";
  const model = config.model ?? "stub-review-v1";

  return {
    provider,
    model,
    review({ answer, evidence, confidenceScore }) {
      const hasEvidence = evidence.length > 0;
      const hasFallback = hasInsufficientSignal(answer);
      const sufficient = hasEvidence && !hasFallback && confidenceScore >= 0.15;

      return {
        status: sufficient ? "sufficient" : "insufficient",
        confidenceScore,
        confidenceBand: toBand(confidenceScore),
        gaps: sufficient ? [] : ["Low evidence support or no matched evidence."],
      };
    },
  };
}
