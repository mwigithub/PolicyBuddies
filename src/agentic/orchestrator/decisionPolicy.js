export const FINALIZATION_REASONS = {
  STOP_CONFIDENCE_REACHED: "STOP_CONFIDENCE_REACHED",
  STOP_MAX_CLARIFICATION_TURNS: "STOP_MAX_CLARIFICATION_TURNS",
  STOP_MAX_TOTAL_TURNS: "STOP_MAX_TOTAL_TURNS",
  STOP_NO_PROGRESS: "STOP_NO_PROGRESS",
  STOP_TIMEOUT: "STOP_TIMEOUT",
  STOP_ERROR_FALLBACK: "STOP_ERROR_FALLBACK",
};

function hasInsufficientAnswer(result) {
  const text = String(result?.answer ?? "").toLowerCase();
  return (
    text.includes("information not found") ||
    text.includes("to be defined")
  );
}

export function computeCriticalGapCount(result) {
  const reviewGaps = Array.isArray(result?.reviewGaps)
    ? result.reviewGaps.filter(
      (gap) => !String(gap ?? "").toLowerCase().includes("gemini review fallback"),
    ).length
    : 0;
  const noCitations = Array.isArray(result?.citations) && result.citations.length === 0
    ? 1
    : 0;
  const insufficient = hasInsufficientAnswer(result) ? 1 : 0;
  return reviewGaps + noCitations + insufficient;
}

export function evaluateStop({
  elapsedProcessingMs,
  limits,
  totalTurns,
  clarificationTurns,
  noProgressStreak,
  latestResult,
}) {
  if (elapsedProcessingMs >= limits.overallTimeoutMs) {
    return {
      shouldStop: true,
      reason: FINALIZATION_REASONS.STOP_TIMEOUT,
    };
  }

  if (totalTurns >= limits.maxTotalTurns) {
    return {
      shouldStop: true,
      reason: FINALIZATION_REASONS.STOP_MAX_TOTAL_TURNS,
    };
  }

  if (clarificationTurns >= limits.maxClarificationTurns) {
    return {
      shouldStop: true,
      reason: FINALIZATION_REASONS.STOP_MAX_CLARIFICATION_TURNS,
    };
  }

  if (noProgressStreak >= 2) {
    return {
      shouldStop: true,
      reason: FINALIZATION_REASONS.STOP_NO_PROGRESS,
    };
  }

  const confidence = Number(latestResult?.confidenceScore ?? 0);
  const criticalGapCount = computeCriticalGapCount(latestResult);
  if (confidence >= limits.minConfidenceToFinalize && criticalGapCount === 0) {
    return {
      shouldStop: true,
      reason: FINALIZATION_REASONS.STOP_CONFIDENCE_REACHED,
    };
  }

  return {
    shouldStop: false,
    reason: null,
  };
}
