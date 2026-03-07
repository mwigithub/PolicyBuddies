import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadEnvFile } from "../config/loadEnv.js";
import { loadLlmConfig } from "../config/llmConfig.js";
import { createDefaultConversationProvider } from "../qa/providers/defaultConversationProvider.js";
import { createConversationLlmProvider } from "../qa/providers/conversationLlmProviderFactory.js";
import { createIntentRouterProvider } from "../qa/providers/intentRouterProviderFactory.js";
import { createDefaultReviewProvider } from "../qa/providers/defaultReviewProvider.js";
import { createReviewProvider } from "../qa/providers/reviewProviderFactory.js";
import { loadRuntimeConfig } from "../config/runtimeConfig.js";
import {
  loadFormulaProductRouting,
  saveFormulaProductRouting,
} from "../config/formulaProductRoutingConfig.js";
import { loadIntentLexicon } from "../config/intentLexiconConfig.js";
import { createQuestionService } from "../qa/questionService.js";
import { createIntentQueryPlanner } from "../qa/intentQueryPlanner.js";
import { createQueryPlannerProvider } from "../qa/providers/queryPlannerProviderFactory.js";
import { createDefaultGapAnalyzerAgent } from "../agentic/agents/gap/defaultGapAnalyzerAgent.js";
import { createDefaultAskAnswerAgent } from "../agentic/agents/ask/defaultAskAnswerAgent.js";
import { createDefaultAnswerCheckerAgent } from "../agentic/agents/checker/defaultAnswerCheckerAgent.js";
import { createAskBackOrchestrator } from "../agentic/orchestrator/askBackOrchestrator.js";

const DEFAULT_TOP_K = 3;
const DEBUG_CHUNK_COUNT = 5;

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
};

function colorize(text, ...styles) {
  const prefix = styles.map((style) => ANSI[style]).filter(Boolean).join("");
  return `${prefix}${text}${ANSI.reset}`;
}

function loadCatalogEntries(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
}

function printDocumentSummary(documents) {
  console.log("\nIndexed Documents (latest completed per source)");
  console.log("===============================================");
  if (documents.length === 0) {
    console.log("No indexed documents found.\n");
    return;
  }

  documents.forEach((doc, index) => {
    console.log(
      `${index + 1}) ${doc.sourcePath} | ${doc.productName}/${doc.versionLabel}/${doc.jurisdiction} | ${doc.documentType ?? "unknown"}`,
    );
  });
  console.log("");
}

function printAnswer(result, llmAnswer, orchestration = null) {
  const prepared = result.askPreparedAnswer ?? null;
  const checkerDecision = result.checkerDecision ?? null;
  const prefersIndustry = result.answerSourcePreference === "industry";
  const industryTemplate = String(result.industryDefinitionAnswer ?? "").trim();
  const selectedSource = checkerDecision?.selectedSource
    ?? (prefersIndustry ? "industry" : "evidence");
  const selectedAnswer = checkerDecision?.selectedAnswer
    ?? (prefersIndustry ? industryTemplate || llmAnswer || result.answer : result.answer);

  console.log(`\n${colorize("Selected Answer", "bold")}`);
  console.log(colorize("===============", "gray"));
  console.log(
    colorize(
      `Source: ${selectedSource}`,
      "gray",
    ),
  );
  if (checkerDecision) {
    console.log(
      colorize(
        `Checker Decision: ${checkerDecision.decision} | hallucinationRisk=${checkerDecision.hallucinationRisk}`,
        "gray",
      ),
    );
    console.log(colorize(`Checker Rationale: ${checkerDecision.rationale}`, "gray"));
  }
  console.log(colorize(selectedAnswer, "green"));
  console.log("");

  console.log(`\n${colorize("Rule-Based Synthesis", "bold", "cyan")}`);
  console.log(colorize("====================", "cyan"));
  console.log(colorize(result.answer, "green"));
  console.log("");
  console.log(`${colorize("LLM-Based Synthesis", "bold", "magenta")}`);
  console.log(colorize("===================", "magenta"));
  if (result.answerMode === "deterministic") {
    console.log(
      colorize(
        "LLM synthesis skipped in deterministic mode (policy-grounded answer).",
        "yellow",
      ),
    );
  } else {
    console.log(colorize(llmAnswer ?? "LLM synthesis unavailable.", "yellow"));
  }
  console.log("");
  console.log(
    `Answer Mode: ${result.answerMode ?? "stochastic"} (${result.answerModeReason ?? "unknown"})`,
  );
  console.log(
    `Answer Source Preference: ${result.answerSourcePreference ?? "industry"}`,
  );
  if (prepared?.openEndedIntent) {
    console.log("Deterministic Path Suggestions:");
    const suggestions = Array.isArray(prepared.deterministicSuggestions)
      ? prepared.deterministicSuggestions
      : [];
    for (const suggestion of suggestions) {
      console.log(`- ${suggestion}`);
    }
  }
  console.log(
    `Confidence: ${result.confidenceScore} ${colorize(`(${result.confidenceBand})`, "bold")}`,
  );
  console.log(`Review Status: ${result.reviewStatus}`);
  if (result.reviewGaps.length > 0) {
    console.log(`Review Gaps: ${result.reviewGaps.join("; ")}`);
  }
  if (result.routingWarning) {
    console.log(`Routing Warning: ${result.routingWarning}`);
  }
  if (orchestration) {
    console.log(
      `Orchestration: reason=${orchestration.finalizationReason}, clarificationTurns=${orchestration.clarificationTurns}, totalTurns=${orchestration.totalTurns}`,
    );
  }

  console.log("\nCitations");
  console.log("=========");
  if (result.citations.length === 0) {
    console.log("No citations.");
  } else {
    result.citations.forEach((item, index) => {
      console.log(
        `${index + 1}) ${item.sourcePath} | lines ${item.lineRange} | ${item.chunkKind} | score ${item.score} | ${item.productName}/${item.versionLabel}/${item.jurisdiction} | ${item.documentType}`,
      );
    });
  }

  console.log(`\n${colorize("Top Retrieved Chunks (Debug)", "gray")}`);
  console.log(colorize("============================", "gray"));
  const topEvidence = (result.evidence ?? []).slice(0, DEBUG_CHUNK_COUNT);
  if (topEvidence.length === 0) {
    console.log("No retrieved chunks.");
  } else {
    topEvidence.forEach((item, index) => {
      const snippet = String(item.text ?? "").replace(/\s+/g, " ").trim();
      const preview = snippet.length > 280 ? `${snippet.slice(0, 277)}...` : snippet;
      console.log(
        `${index + 1}) ${item.sourcePath} | lines ${item.lineStart}-${item.lineEnd} | ${item.chunkKind} | score ${item.score}`,
      );
      console.log(`   ${preview}`);
    });
  }

  if (result.skipped.length > 0) {
    console.log("\nSkipped Documents");
    console.log("=================");
    result.skipped.forEach((item, index) => {
      console.log(`${index + 1}) ${item.sourcePath} (${item.reason})`);
    });
  }
  console.log("");
}

function printFormulaRouting(config) {
  const mappings = Array.isArray(config?.mappings) ? config.mappings : [];
  console.log("\nFormula Product Routing");
  console.log("=======================");
  console.log(`Default Product Key: ${config?.defaultProductKey ?? "none"}`);
  if (mappings.length === 0) {
    console.log("No mappings configured.\n");
    return;
  }
  mappings.forEach((item, index) => {
    const names = (item.productNames ?? []).join(", ") || "-";
    const aliases = (item.aliases ?? []).join(", ") || "-";
    console.log(
      `${index + 1}) key=${item.productKey} | productNames=[${names}] | aliases=[${aliases}]`,
    );
  });
  console.log("");
}

async function runFormulaRoutingMenu({
  rl,
  runtimeConfig,
  formulaProductRouting,
  onConfigUpdated,
}) {
  let localConfig = {
    ...formulaProductRouting,
    mappings: Array.isArray(formulaProductRouting?.mappings)
      ? formulaProductRouting.mappings.map((item) => ({
        productKey: item.productKey,
        productNames: Array.isArray(item.productNames) ? [...item.productNames] : [],
        aliases: Array.isArray(item.aliases) ? [...item.aliases] : [],
      }))
      : [],
  };
  let done = false;

  while (!done) {
    console.log("Formula Routing Menu");
    console.log("====================");
    console.log("1) View mappings");
    console.log("2) Add mapping");
    console.log("3) Remove mapping");
    console.log("4) Set default product key");
    console.log("5) Save");
    console.log("6) Back");
    const selected = (await rl.question("Select option: ")).trim();

    if (selected === "1") {
      printFormulaRouting(localConfig);
      continue;
    }

    if (selected === "2") {
      const productKey = (await rl.question("Product key (e.g. wealth-pro-v1): ")).trim();
      if (!productKey) {
        console.log("Product key is required.\n");
        continue;
      }
      const productNamesRaw = (
        await rl.question("Product names (comma-separated): ")
      ).trim();
      const aliasesRaw = (await rl.question("Aliases (comma-separated, optional): ")).trim();
      const productNames = productNamesRaw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const aliases = aliasesRaw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (productNames.length === 0) {
        console.log("At least one product name is required.\n");
        continue;
      }
      localConfig.mappings.push({
        productKey,
        productNames,
        aliases,
      });
      console.log("Mapping added.\n");
      continue;
    }

    if (selected === "3") {
      if (localConfig.mappings.length === 0) {
        console.log("No mappings to remove.\n");
        continue;
      }
      printFormulaRouting(localConfig);
      const idx = Number((await rl.question("Mapping number to remove: ")).trim());
      if (Number.isNaN(idx) || idx < 1 || idx > localConfig.mappings.length) {
        console.log("Invalid mapping number.\n");
        continue;
      }
      localConfig.mappings.splice(idx - 1, 1);
      console.log("Mapping removed.\n");
      continue;
    }

    if (selected === "4") {
      const defaultProductKey = (
        await rl.question("Default product key (empty to clear): ")
      ).trim();
      localConfig.defaultProductKey = defaultProductKey || null;
      console.log("Default product key updated.\n");
      continue;
    }

    if (selected === "5") {
      saveFormulaProductRouting(runtimeConfig.formulaProductRoutingPath, localConfig);
      onConfigUpdated(localConfig);
      console.log(`Saved to ${runtimeConfig.formulaProductRoutingPath}\n`);
      continue;
    }

    if (selected === "6") {
      done = true;
      console.log("");
      continue;
    }

    console.log("Invalid option.\n");
  }
}

export async function runAskUi() {
  loadEnvFile();
  const runtimeConfig = loadRuntimeConfig();
  let formulaProductRouting = loadFormulaProductRouting(
    runtimeConfig.formulaProductRoutingPath,
  );
  const intentLexicon = loadIntentLexicon(runtimeConfig.intentLexiconPath);
  const llmConfig = loadLlmConfig();
  const catalogEntries = loadCatalogEntries(runtimeConfig.ingestionCatalogPath);
  let conversationProvider = null;
  const queryPlannerProvider = createQueryPlannerProvider(
    llmConfig.queryPlannerLlm ?? llmConfig.intentRouting ?? {},
  );
  const queryPlanner = createIntentQueryPlanner({
    policyPath: runtimeConfig.queryRoutingPolicyPath,
    llmPlannerProvider: queryPlannerProvider,
    llmFirst: Boolean(runtimeConfig.planner.llmFirst),
    minPlannerConfidence: Number(runtimeConfig.planner.minPlannerConfidence ?? 0.6),
    intentLexicon,
  });
  const llmConversationProvider = createConversationLlmProvider(
    llmConfig.conversationLlm ?? {},
  );
  const intentRouterProvider = createIntentRouterProvider(
    llmConfig.intentRouting ?? llmConfig.conversationLlm ?? {},
  );
  const reviewProvider = createDefaultReviewProvider(llmConfig.confidenceReview);
  const reviewLlmProvider = createReviewProvider(llmConfig.confidenceReview);
  let questionService = null;
  const gapAnalyzerAgent = createDefaultGapAnalyzerAgent();
  const askAnswerAgent = createDefaultAskAnswerAgent();
  const checkerLlmConfig = llmConfig.checkerLlm ?? llmConfig.intentRouting ?? {};
  const answerCheckerAgent = createDefaultAnswerCheckerAgent({
    llmJudgeEnabled: Boolean(checkerLlmConfig.enabled),
    llmJudgeModel: checkerLlmConfig.model,
    llmJudgeBaseUrl: checkerLlmConfig.baseUrl,
  });
  let askBackOrchestrator = null;

  const rebuildAskRuntime = () => {
    conversationProvider = createDefaultConversationProvider(
      {
        ...llmConfig.conversation,
        formulaRegistryDir: runtimeConfig.formulaRegistryDir,
        formulaProductKey: runtimeConfig.formulaProductKey,
        formulaProductRouting,
      },
    );
    questionService = createQuestionService({
      catalogEntries,
      conversationProvider,
      reviewProvider,
      intentRouter: intentRouterProvider,
      queryPlanner,
      plannerOptions: runtimeConfig.planner,
      intentLexicon,
    });
    askBackOrchestrator = createAskBackOrchestrator({
      questionService,
      llmConversationProvider,
      reviewProvider,
      reviewLlmProvider,
      gapAnalyzerAgent,
      askAnswerAgent,
      checkerAgent: answerCheckerAgent,
      limits: runtimeConfig.agenticOrchestration,
    });
  };

  rebuildAskRuntime();

  const rl = createInterface({ input, output });
  let done = false;

  const runAskLoop = async () => {
    let back = false;
    while (!back) {
      const question = (
        await rl.question("Question (or type 'back' to main menu): ")
      ).trim();
      if (!question) {
        console.log("Question is required.\n");
        continue;
      }
      if (question.toLowerCase() === "back") {
        back = true;
        console.log("");
        continue;
      }

      let effective;
      if (runtimeConfig.agenticOrchestration.enabled) {
        const orchestration = await askBackOrchestrator.run({
          question,
          topK: DEFAULT_TOP_K,
          askUser: async (clarifyingQuestion) =>
            rl.question(`Clarification: ${clarifyingQuestion}\nYour answer (or 'back' to stop): `),
        });
        effective = orchestration;
      } else {
        const directResult = await questionService.ask({
          question,
          filters: undefined,
          topK: DEFAULT_TOP_K,
        });
        let directLlmAnswer;
        const shouldUseLlmSynthesis =
          directResult.answerSourcePreference === "industry" ||
          directResult.answerMode !== "deterministic";
        if (shouldUseLlmSynthesis && !directResult.industryDefinitionAnswer) {
          try {
            directLlmAnswer = await llmConversationProvider.synthesizeAnswer({
              question,
              evidence: directResult.evidence ?? [],
            });
          } catch (error) {
            directLlmAnswer = `LLM synthesis failed: ${
              error instanceof Error ? error.message : String(error)
            }`;
          }
        }
        effective = { result: directResult, llmAnswer: directLlmAnswer };
      }
      const result = effective.result ?? {
        answer: "information not found",
        confidenceScore: 0,
        confidenceBand: "low",
        reviewStatus: "fallback",
        reviewGaps: ["No result returned from orchestrator."],
        citations: [],
        evidence: [],
        skipped: [],
      };
      const llmAnswer = effective.llmAnswer;
      if (!result.askPreparedAnswer) {
        const prepared = askAnswerAgent.execute({
          question,
          result,
          llmAnswer,
        });
        result.askPreparedAnswer = prepared?.preparedAnswer ?? null;
      }
      if (!result.checkerDecision) {
        result.checkerDecision = await answerCheckerAgent.execute({
          question,
          result,
          llmAnswer,
          preparedAnswer: result.askPreparedAnswer,
        });
      }

      console.log(
        "\nSearch scope: latest indexed documents across all available information.",
      );
      console.log(`Top K citations: ${DEFAULT_TOP_K}`);
      console.log(
        `Conversation module: ${conversationProvider.provider} / ${conversationProvider.model}`,
      );
      console.log(
        `Intent routing module: ${intentRouterProvider.provider} / ${intentRouterProvider.model} (${result.intentRouting?.routeSource ?? "unknown"})`,
      );
      console.log("Intent Debug:");
      if (result.queryNormalization) {
        console.log(
          `  query: original="${result.queryNormalization.originalQuestion}" | normalized="${result.queryNormalization.normalizedQuestion}"`,
        );
        const corrections = result.queryNormalization.appliedCorrections ?? [];
        if (corrections.length > 0) {
          console.log(
            `  corrections: ${corrections
              .map((item) => `${item.from}->${item.to}`)
              .join(", ")}`,
          );
        }
      }
      const exactMatches = result.lexiconMatches?.exactMatches ?? [];
      const fuzzyMatches = result.lexiconMatches?.fuzzyMatches ?? [];
      if (exactMatches.length > 0 || fuzzyMatches.length > 0) {
        console.log(
          `  lexicon matches: exact=${exactMatches
            .map((item) => item.canonicalTerm)
            .join(", ") || "none"} | fuzzy=${fuzzyMatches
            .map((item) => `${item.canonicalTerm}(${item.matchedToken})`)
            .join(", ") || "none"}`,
        );
      }
      console.log(
        `  routed: table=${Boolean(result.intentRouting?.tableIntent)}, formula=${Boolean(result.intentRouting?.formulaIntent)}, metadata=${Boolean(result.intentRouting?.metadataIntent)}, rider=${Boolean(result.intentRouting?.riderIntent ?? false)}, scope=${result.intentRouting?.scopeHint ?? "none"}, routeConfidence=${Number(result.intentRouting?.confidence ?? 0).toFixed(3)}`,
      );
      if (result.queryPlan) {
        console.log(
          `  planner: intentClass=${result.queryPlan.intentClass ?? "unknown"}, topK=${result.queryPlan.topK}, strict=${Boolean(result.queryPlan.strictRouting)}, source=${result.queryPlan.plannerSource ?? "unknown"}, confidence=${Number(result.queryPlan.plannerConfidence ?? 0).toFixed(3)}, llmFirst=${Boolean(result.queryPlan.llmFirst)}`,
        );
        console.log(
          `  planner preference: docs=[${(result.queryPlan.preferredDocumentTypes ?? []).join(", ") || "all"}], chunks=[${(result.queryPlan.preferredChunkKinds ?? []).join(", ") || "all"}]`,
        );
      }
      console.log(
        `Conversation LLM module: ${llmConversationProvider.provider} / ${llmConversationProvider.model}`,
      );
      console.log(
        `Confidence review module: ${
          (reviewLlmProvider ?? reviewProvider).provider
        } / ${(reviewLlmProvider ?? reviewProvider).model}`,
      );
      console.log(
        `Agentic limits: clarifications=${runtimeConfig.agenticOrchestration.maxClarificationTurns}, totalTurns=${runtimeConfig.agenticOrchestration.maxTotalTurns}, minConfidence=${runtimeConfig.agenticOrchestration.minConfidenceToFinalize}, timeoutMs=${runtimeConfig.agenticOrchestration.overallTimeoutMs}`,
      );
      printAnswer(
        result,
        llmAnswer,
        runtimeConfig.agenticOrchestration.enabled ? effective : null,
      );
      if (result.intentRouting?.scopeHint) {
        console.log(
          `Assumed scope: ${result.intentRouting.scopeHint} (auto). Say \"use ${result.intentRouting.scopeHint === "product summary" ? "policy illustration" : "product summary"}\" to switch.`,
        );
      }
      console.log("");
    }
  };

  while (!done) {
    const documents = questionService.listIndexedDocuments();
    console.log("PolicyBuddies Ask Terminal");
    console.log("==========================");
    console.log("1) List indexed documents");
    console.log("2) Ask question");
    console.log("3) Manage formula product routing");
    console.log("4) Exit");
    const selected = (await rl.question("Select option: ")).trim();

    if (selected === "1") {
      printDocumentSummary(documents);
      continue;
    }

    if (selected === "2") {
      if (documents.length === 0) {
        console.log("No indexed documents. Ingest documents first.\n");
        continue;
      }
      await runAskLoop();
      continue;
    }

    if (selected === "3") {
      await runFormulaRoutingMenu({
        rl,
        runtimeConfig,
        formulaProductRouting,
        onConfigUpdated: (nextConfig) => {
          formulaProductRouting = nextConfig;
          rebuildAskRuntime();
        },
      });
      continue;
    }

    if (selected === "4") {
      done = true;
      continue;
    }

    console.log("Invalid option.\n");
  }

  rl.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runAskUi();
}
