import {
  FINALIZATION_REASONS,
  computeCriticalGapCount,
  evaluateStop,
} from "./decisionPolicy.js";

const DEFAULT_LIMITS = {
  maxClarificationTurns: 3,
  maxTotalTurns: 6,
  maxQuestionsPerTurn: 1,
  maxRetriesPerAgent: 1,
  minConfidenceToFinalize: 0.75,
  overallTimeoutMs: 30000,
};

function compact(value) {
  return String(value ?? "").trim();
}

function buildPromptQuestion(initialQuestion, answers) {
  if (answers.length === 0) {
    return initialQuestion;
  }
  const contextLines = answers.map((item, index) => `C${index + 1}: ${item}`);
  return `${initialQuestion}\n\nClarification Context:\n${contextLines.join("\n")}`;
}

export function createAskBackOrchestrator({
  questionService,
  llmConversationProvider,
  reviewProvider,
  reviewLlmProvider,
  gapAnalyzerAgent,
  askAnswerAgent,
  checkerAgent,
  limits = {},
}) {
  const resolvedLimits = {
    ...DEFAULT_LIMITS,
    ...(limits ?? {}),
  };

  return {
    async run({
      question,
      topK = 3,
      askUser,
    }) {
      let elapsedProcessingMs = 0;
      const clarificationAnswers = [];
      const askedQuestions = [];
      const history = [];
      let totalTurns = 0;
      let clarificationTurns = 0;
      let noProgressStreak = 0;
      let previousGapCount = Number.POSITIVE_INFINITY;
      let finalizationReason = FINALIZATION_REASONS.STOP_ERROR_FALLBACK;
      let latestResult = null;
      let latestLlmAnswer = null;
      let latestGapResult = null;

      while (true) {
        const turnStartedAtMs = Date.now();
        totalTurns += 1;
        const composedQuestion = buildPromptQuestion(question, clarificationAnswers);
        latestResult = await questionService.ask({
          question: composedQuestion,
          filters: undefined,
          topK,
        });

        const shouldUseLlmSynthesis =
          latestResult.answerSourcePreference === "industry" ||
          latestResult.answerMode !== "deterministic";
        if (shouldUseLlmSynthesis) {
          try {
            latestLlmAnswer = await llmConversationProvider.synthesizeAnswer({
              question: composedQuestion,
              evidence: latestResult.evidence ?? [],
            });
          } catch (error) {
            latestLlmAnswer = `LLM synthesis failed: ${
              error instanceof Error ? error.message : String(error)
            }`;
          }
        } else {
          latestLlmAnswer = null;
        }

        const prepared = askAnswerAgent?.execute
          ? askAnswerAgent.execute({
            question: composedQuestion,
            result: latestResult,
            llmAnswer: latestLlmAnswer,
          })
          : null;
        latestResult.askPreparedAnswer = prepared?.preparedAnswer ?? null;
        latestResult.checkerDecision = checkerAgent?.execute
          ? await checkerAgent.execute({
            question: composedQuestion,
            result: latestResult,
            llmAnswer: latestLlmAnswer,
            preparedAnswer: latestResult.askPreparedAnswer,
          })
          : null;
        const answerForReview =
          latestResult.checkerDecision?.selectedAnswer ??
          latestLlmAnswer ??
          latestResult.answer;

        if (reviewLlmProvider) {
          try {
            const reviewed = await reviewLlmProvider.review({
              question: composedQuestion,
              answer: answerForReview,
              evidence: latestResult.evidence ?? [],
              confidenceScore: latestResult.confidenceScore,
            });
            latestResult.confidenceScore = reviewed.confidenceScore;
            latestResult.confidenceBand = reviewed.confidenceBand;
            latestResult.reviewStatus = reviewed.status;
            latestResult.reviewGaps = reviewed.gaps;
          } catch (error) {
            const fallback = reviewProvider?.review
              ? reviewProvider.review({
                answer: answerForReview,
                evidence: latestResult.evidence ?? [],
                confidenceScore: latestResult.confidenceScore,
              })
              : null;
            if (fallback) {
              latestResult.confidenceScore = fallback.confidenceScore;
              latestResult.confidenceBand = fallback.confidenceBand;
              latestResult.reviewStatus = fallback.status;
              latestResult.reviewGaps = [
                ...(fallback.gaps ?? []),
              ];
            }
            latestResult.reviewGaps = [
              ...(latestResult.reviewGaps ?? []),
              `Gemini review fallback: ${
                error instanceof Error ? error.message : String(error)
              }`,
            ];
          }
        } else if (reviewProvider?.review) {
          const reviewed = reviewProvider.review({
            answer: answerForReview,
            evidence: latestResult.evidence ?? [],
            confidenceScore: latestResult.confidenceScore,
          });
          latestResult.confidenceScore = reviewed.confidenceScore;
          latestResult.confidenceBand = reviewed.confidenceBand;
          latestResult.reviewStatus = reviewed.status;
          latestResult.reviewGaps = reviewed.gaps;
        }

        latestGapResult = gapAnalyzerAgent.execute({
          latestResult,
          askedQuestions,
          originalQuestion: question,
          clarificationAnswers,
        });

        const gapCount = computeCriticalGapCount(latestResult);
        if (gapCount < previousGapCount) {
          noProgressStreak = 0;
        } else {
          noProgressStreak += 1;
        }
        previousGapCount = gapCount;

        history.push({
          turn: totalTurns,
          question: composedQuestion,
          confidenceScore: latestResult.confidenceScore,
          criticalGapCount: gapCount,
          reviewStatus: latestResult.reviewStatus,
        });
        elapsedProcessingMs += Date.now() - turnStartedAtMs;

        const stop = evaluateStop({
          elapsedProcessingMs,
          limits: resolvedLimits,
          totalTurns,
          clarificationTurns,
          noProgressStreak,
          latestResult,
        });

        if (stop.shouldStop) {
          finalizationReason = stop.reason;
          break;
        }

        const nextQuestion = compact(latestGapResult?.nextBestQuestion);
        if (!nextQuestion) {
          finalizationReason = FINALIZATION_REASONS.STOP_CONFIDENCE_REACHED;
          break;
        }
        if (askedQuestions.some((item) => item.toLowerCase() === nextQuestion.toLowerCase())) {
          finalizationReason = FINALIZATION_REASONS.STOP_NO_PROGRESS;
          break;
        }
        if (resolvedLimits.maxQuestionsPerTurn <= 0) {
          finalizationReason = FINALIZATION_REASONS.STOP_MAX_CLARIFICATION_TURNS;
          break;
        }

        askedQuestions.push(nextQuestion);
        const userAnswer = compact(await askUser(nextQuestion));
        if (!userAnswer || userAnswer.toLowerCase() === "back") {
          finalizationReason = FINALIZATION_REASONS.STOP_ERROR_FALLBACK;
          break;
        }
        clarificationAnswers.push(userAnswer);
        clarificationTurns += 1;
      }

      return {
        result: latestResult,
        llmAnswer: latestLlmAnswer,
        finalizationReason,
        clarificationTurns,
        totalTurns,
        history,
        askedQuestions,
      };
    },
  };
}
