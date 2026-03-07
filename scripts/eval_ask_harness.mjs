import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { loadRuntimeConfig } from "../src/config/runtimeConfig.js";
import { loadLlmConfig } from "../src/config/llmConfig.js";
import { createQuestionService } from "../src/qa/questionService.js";
import { createDefaultConversationProvider } from "../src/qa/providers/defaultConversationProvider.js";
import { createDefaultReviewProvider } from "../src/qa/providers/defaultReviewProvider.js";
import { createOllamaConversationProvider } from "../src/qa/providers/ollamaConversationProvider.js";
import { createOllamaIntentRouterProvider } from "../src/qa/providers/ollamaIntentRouterProvider.js";
import { createIntentQueryPlanner } from "../src/qa/intentQueryPlanner.js";
import { createOllamaQueryPlannerProvider } from "../src/qa/providers/ollamaQueryPlannerProvider.js";
import { loadFormulaProductRouting } from "../src/config/formulaProductRoutingConfig.js";
import { loadIntentLexicon } from "../src/config/intentLexiconConfig.js";
import { createDefaultAskAnswerAgent } from "../src/agentic/agents/ask/defaultAskAnswerAgent.js";
import { createDefaultAnswerCheckerAgent } from "../src/agentic/agents/checker/defaultAnswerCheckerAgent.js";
import { createReviewProvider } from "../src/qa/providers/reviewProviderFactory.js";

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function loadJson(path) {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8"));
}

function includesAny(text, values = []) {
  const normalized = normalize(text);
  return values.some((value) => normalized.includes(normalize(value)));
}

function evaluateCaseExpectations(result, expect = {}) {
  const checks = [];
  if (expect.decision) {
    checks.push({
      name: "decision",
      pass: normalize(result.decision) === normalize(expect.decision),
      actual: result.decision,
      expected: expect.decision,
    });
  }
  if (expect.source) {
    checks.push({
      name: "source",
      pass: normalize(result.selectedSource) === normalize(expect.source),
      actual: result.selectedSource,
      expected: expect.source,
    });
  }
  if (Array.isArray(expect.containsAny) && expect.containsAny.length > 0) {
    checks.push({
      name: "containsAny",
      pass: includesAny(result.selectedAnswer, expect.containsAny),
      actual: result.selectedAnswer,
      expected: expect.containsAny.join(" | "),
    });
  }
  const pass = checks.every((item) => item.pass);
  return { pass, checks };
}

async function run() {
  const runtimeConfig = loadRuntimeConfig();
  const llmConfig = loadLlmConfig();
  const evalPath = process.argv[2] ?? "metadata/runtime/evals/ask-golden-set.json";
  const suite = loadJson(evalPath);
  const catalog = loadJson(runtimeConfig.ingestionCatalogPath).entries ?? [];

  const formulaProductRouting = loadFormulaProductRouting(
    runtimeConfig.formulaProductRoutingPath,
  );
  const intentLexicon = loadIntentLexicon(runtimeConfig.intentLexiconPath);

  const conversationProvider = createDefaultConversationProvider({
    ...llmConfig.conversation,
    formulaRegistryDir: runtimeConfig.formulaRegistryDir,
    formulaProductKey: runtimeConfig.formulaProductKey,
    formulaProductRouting,
  });
  const llmConversationProvider = createOllamaConversationProvider(
    llmConfig.conversationLlm ?? {},
  );
  const intentRouter = createOllamaIntentRouterProvider(
    llmConfig.intentRouting ?? llmConfig.conversationLlm ?? {},
  );
  const queryPlanner = createIntentQueryPlanner({
    policyPath: runtimeConfig.queryRoutingPolicyPath,
    llmPlannerProvider: createOllamaQueryPlannerProvider(
      llmConfig.queryPlannerLlm ?? llmConfig.intentRouting ?? {},
    ),
    llmFirst: Boolean(runtimeConfig.planner.llmFirst),
    minPlannerConfidence: Number(runtimeConfig.planner.minPlannerConfidence ?? 0.6),
    intentLexicon,
  });
  const reviewProvider = createDefaultReviewProvider(llmConfig.confidenceReview);
  const reviewLlmProvider = createReviewProvider(llmConfig.confidenceReview);
  const askAgent = createDefaultAskAnswerAgent();
  const checkerAgent = createDefaultAnswerCheckerAgent({
    llmJudgeEnabled: Boolean(llmConfig.checkerLlm?.enabled),
    llmJudgeModel: llmConfig.checkerLlm?.model,
    llmJudgeBaseUrl: llmConfig.checkerLlm?.baseUrl,
  });

  const questionService = createQuestionService({
    catalogEntries: catalog,
    conversationProvider,
    reviewProvider,
    intentRouter,
    queryPlanner,
    plannerOptions: runtimeConfig.planner,
    intentLexicon,
  });

  const rows = [];
  for (const testCase of suite.cases ?? []) {
    const started = performance.now();
    const topK = Number(testCase.topK ?? suite.defaultTopK ?? 3);
    const askResult = await questionService.ask({
      question: testCase.question,
      filters: undefined,
      topK,
    });

    let llmAnswer = null;
    const shouldUseLlmSynthesis =
      askResult.answerSourcePreference === "industry" ||
      askResult.answerMode !== "deterministic";
    if (shouldUseLlmSynthesis && !askResult.industryDefinitionAnswer) {
      try {
        llmAnswer = await llmConversationProvider.synthesizeAnswer({
          question: testCase.question,
          evidence: askResult.evidence ?? [],
        });
      } catch {
        llmAnswer = null;
      }
    }

    const prepared = askAgent.execute({
      question: testCase.question,
      result: askResult,
      llmAnswer,
    });
    const checkerDecision = await checkerAgent.execute({
      question: testCase.question,
      result: askResult,
      llmAnswer,
      preparedAnswer: prepared?.preparedAnswer,
    });
    const finalAnswer = checkerDecision.selectedAnswer;

    let reviewed = {
      status: askResult.reviewStatus,
      confidenceScore: askResult.confidenceScore,
      confidenceBand: askResult.confidenceBand,
      gaps: askResult.reviewGaps ?? [],
    };
    if (reviewLlmProvider?.review) {
      try {
        reviewed = await reviewLlmProvider.review({
          question: testCase.question,
          answer: finalAnswer,
          evidence: askResult.evidence ?? [],
          confidenceScore: askResult.confidenceScore,
        });
      } catch {
        reviewed = reviewProvider.review({
          answer: finalAnswer,
          evidence: askResult.evidence ?? [],
          confidenceScore: askResult.confidenceScore,
        });
      }
    } else {
      reviewed = reviewProvider.review({
        answer: finalAnswer,
        evidence: askResult.evidence ?? [],
        confidenceScore: askResult.confidenceScore,
      });
    }

    const elapsedMs = Number((performance.now() - started).toFixed(1));
    const evaluation = evaluateCaseExpectations(
      {
        decision: checkerDecision.decision,
        selectedSource: checkerDecision.selectedSource,
        selectedAnswer: finalAnswer,
      },
      testCase.expect ?? {},
    );

    rows.push({
      id: testCase.id,
      question: testCase.question,
      pass: evaluation.pass,
      elapsedMs,
      checkerDecision: checkerDecision.decision,
      selectedSource: checkerDecision.selectedSource,
      hallucinationRisk: checkerDecision.hallucinationRisk,
      reviewStatus: reviewed.status,
      reviewConfidence: reviewed.confidenceScore,
      checks: evaluation.checks,
      finalAnswerPreview: String(finalAnswer ?? "").replace(/\s+/g, " ").slice(0, 220),
    });
  }

  const total = rows.length;
  const passed = rows.filter((row) => row.pass).length;
  const failed = total - passed;
  const avgMs = total > 0
    ? Number((rows.reduce((sum, row) => sum + row.elapsedMs, 0) / total).toFixed(1))
    : 0;
  const summary = {
    suite: suite.name ?? "unnamed-suite",
    total,
    passed,
    failed,
    passRate: total > 0 ? Number(((passed / total) * 100).toFixed(1)) : 0,
    avgLatencyMs: avgMs,
  };

  console.log("\nPolicyBuddies Ask Evaluation");
  console.log("============================");
  console.log(JSON.stringify(summary, null, 2));
  console.log("\nCase Results");
  console.log("============");
  for (const row of rows) {
    console.log(
      `- ${row.id}: ${row.pass ? "PASS" : "FAIL"} | ${row.checkerDecision}/${row.selectedSource} | review=${row.reviewStatus}:${row.reviewConfidence} | ${row.elapsedMs}ms`,
    );
    for (const check of row.checks) {
      if (!check.pass) {
        console.log(
          `  check fail [${check.name}] expected=${check.expected} actual=${check.actual}`,
        );
      }
    }
  }
}

run().catch((error) => {
  console.error(
    `Evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
