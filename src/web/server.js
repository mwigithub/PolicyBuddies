import express from "express";
import { loadEnvFile } from "../config/loadEnv.js";
import { loadLlmConfig } from "../config/llmConfig.js";
import { createIngestionRuntime } from "../ingestion/bootstrap.js";
import { createFileIngestionCatalog } from "../ingestion/catalog/fileIngestionCatalog.js";
import { createPostgresIngestionCatalog } from "../ingestion/catalog/postgresIngestionCatalog.js";
import { getPool } from "../db/pool.js";
import { createQuestionService } from "../qa/questionService.js";
import { createIntentQueryPlanner } from "../qa/intentQueryPlanner.js";
import { createQueryPlannerProvider } from "../qa/providers/queryPlannerProviderFactory.js";
import { createDefaultConversationProvider } from "../qa/providers/defaultConversationProvider.js";
import { createDefaultReviewProvider } from "../qa/providers/defaultReviewProvider.js";
import { createConversationLlmProvider } from "../qa/providers/conversationLlmProviderFactory.js";
import { createIntentRouterProvider } from "../qa/providers/intentRouterProviderFactory.js";
import { createReviewProvider } from "../qa/providers/reviewProviderFactory.js";
import { createDefaultGapAnalyzerAgent } from "../agentic/agents/gap/defaultGapAnalyzerAgent.js";
import { createDefaultAskAnswerAgent } from "../agentic/agents/ask/defaultAskAnswerAgent.js";
import { createDefaultAnswerCheckerAgent } from "../agentic/agents/checker/defaultAnswerCheckerAgent.js";
import { createAskBackOrchestrator } from "../agentic/orchestrator/askBackOrchestrator.js";
import { createSemanticReranker } from "../qa/providers/semanticReranker.js";

// ── Initialise ──────────────────────────────────────────────────────────────
loadEnvFile();
const llmConfig = loadLlmConfig();
const runtime = createIngestionRuntime();

// ── Catalog store ───────────────────────────────────────────────────────────
// Configured via config/runtime.json → catalog.provider
// "file"     — default, zero dependencies, works locally
// "postgres" — requires DATABASE_URL; works on Supabase and AWS RDS
const catalogProvider = runtime.runtimeConfig.catalog?.provider ?? "file";
let catalog;
if (catalogProvider === "postgres") {
  catalog = createPostgresIngestionCatalog({ pool: getPool() });
  console.log("[server] Catalog store: postgres");
} else {
  catalog = createFileIngestionCatalog({
    catalogPath: runtime.runtimeConfig.ingestionCatalogPath,
  });
  console.log(`[server] Catalog store: file (${runtime.runtimeConfig.ingestionCatalogPath})`);
}

// ── Providers (created once at startup — stateless, safe to reuse) ──────────
const conversationProvider = createDefaultConversationProvider();
const reviewProvider = createDefaultReviewProvider();
const llmConversationProvider = createConversationLlmProvider(llmConfig);
const reviewLlmProvider = createReviewProvider(llmConfig);
const intentRouterProvider = createIntentRouterProvider(llmConfig);
const queryPlannerProvider = createQueryPlannerProvider(llmConfig);

const intentPlanner = createIntentQueryPlanner({
  llmPlannerProvider: queryPlannerProvider,
  llmFirst: runtime.runtimeConfig.planner?.llmFirst,
  minPlannerConfidence: runtime.runtimeConfig.planner?.minPlannerConfidence,
});

// ── Agents (stateless — no constructor params needed) ───────────────────────
const gapAnalyzerAgent = createDefaultGapAnalyzerAgent();
const askAnswerAgent = createDefaultAskAnswerAgent();
const answerCheckerAgent = createDefaultAnswerCheckerAgent();

// ── Semantic reranker — blends keyword + sentence-transformer similarity ─────
const semanticReranker = createSemanticReranker(llmConfig.semanticEmbedding ?? {});

// ── Express app ─────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.text({ limit: "50mb" }));

// CORS — set ALLOWED_ORIGIN env var to restrict in production (e.g. "https://yourapp.com")
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================================
// Health Check
// ============================================================
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: {
      llmProvider: llmConfig.provider,
      pipeline: runtime.runtimeConfig.pipelineVersion,
      catalogProvider,
      vectorStoreProvider: runtime.runtimeConfig.vectorStore?.provider ?? "file",
    },
  });
});

// ============================================================
// Catalog
// ============================================================
app.get("/api/catalog", async (_req, res) => {
  try {
    // await works transparently with both sync (file) and async (postgres) implementations
    const entries = await catalog.getLatestDocuments();
    res.json({
      success: true,
      documentCount: entries.length,
      documents: entries.map((doc) => ({
        id: doc.id,
        sourcePath: doc.sourcePath,
        productName: doc.productName,
        jurisdiction: doc.jurisdiction,
        versionLabel: doc.versionLabel,
        documentType: doc.documentType,
        indexedAt: doc.indexedAt,
      })),
    });
  } catch (error) {
    console.error("Catalog error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve catalog. Check server logs for details.",
    });
  }
});

// ============================================================
// Config
// ============================================================
app.get("/api/config", (_req, res) => {
  res.json({
    success: true,
    config: {
      pipelineVersion: runtime.runtimeConfig.pipelineVersion,
      planner: runtime.runtimeConfig.planner,
      agenticOrchestration: runtime.runtimeConfig.agenticOrchestration,
      vectorStoreProvider: runtime.runtimeConfig.vectorStore?.provider ?? "file",
      catalogProvider: runtime.runtimeConfig.catalog?.provider ?? "file",
      ingestionSourceDir: runtime.runtimeConfig.ingestionSourceDir,
    },
  });
});

// ============================================================
// Ingest
// ============================================================
app.post("/api/ingest", async (req, res) => {
  try {
    const { filename, content, metadata, actorId = "api-user" } = req.body;

    if (!filename || !content || !metadata) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required fields: filename, content, metadata (productName, jurisdiction, versionLabel, documentType)",
      });
    }

    // ingestionService.ingest() is async to support postgres vector stores
    const ingestResult = await runtime.ingestionService.ingest({
      sourceUri: filename,
      rawContent: content,
      metadata,
      actorId,
      mimeType: filename.endsWith(".pdf") ? "application/pdf" : "text/plain",
    });

    // catalog.appendEntry() is awaited — works with both file (sync) and postgres (async)
    await catalog.appendEntry({
      id: ingestResult.documentVersionId,
      sourcePath: filename,
      productName: metadata.productName,
      jurisdiction: metadata.jurisdiction,
      versionLabel: metadata.versionLabel,
      documentType: metadata.documentType || "unknown",
      status: "completed",
      indexedAt: new Date().toISOString(),
      runId: ingestResult.runId,
    });

    res.json({
      success: true,
      runId: ingestResult.runId,
      documentVersionId: ingestResult.documentVersionId,
      chunksGenerated: ingestResult.chunkCount,
      vectorsStored: ingestResult.vectorCount,
    });
  } catch (error) {
    console.error("Ingestion error:", error);
    res.status(500).json({
      success: false,
      error: "Ingestion failed. Check server logs for details.",
    });
  }
});

// ============================================================
// Ask
// ============================================================
app.post("/api/ask", async (req, res) => {
  try {
    const { question, topK = 3 } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: question",
      });
    }

    // Build question service with fresh catalog entries so newly ingested docs are included
    const catalogEntries = await catalog.getLatestDocuments();
    const questionService = createQuestionService({
      catalogEntries,
      conversationProvider,
      reviewProvider,
      intentRouter: intentRouterProvider,
      queryPlanner: intentPlanner,
      plannerOptions: runtime.runtimeConfig.planner,
      semanticReranker,
    });

    const orchestrator = createAskBackOrchestrator({
      questionService,
      llmConversationProvider,
      reviewProvider,
      reviewLlmProvider,
      gapAnalyzerAgent,
      askAnswerAgent,
      checkerAgent: answerCheckerAgent,
      limits: runtime.runtimeConfig.agenticOrchestration,
    });

    // No interactive user in HTTP context — return best answer without clarification turns
    const runResult = await orchestrator.run({
      question,
      topK,
      askUser: async () => "",
    });

    const qaResult = runResult.result;
    const finalAnswer =
      qaResult.checkerDecision?.selectedAnswer ||
      qaResult.askPreparedAnswer?.selectedAnswer ||
      qaResult.answer;

    res.json({
      success: true,
      question,
      answer: finalAnswer,
      confidence: qaResult.confidenceScore || 0,
      sources: qaResult.citations || [],
      reasoning: {
        detectedIntent: qaResult.queryPlan?.intentClass,
        clarificationNeeded: (runResult.askedQuestions?.length ?? 0) > 0,
        clarificationQuestions: runResult.askedQuestions || [],
        turnCount: runResult.totalTurns || 0,
      },
      orchestration: {
        status: runResult.finalizationReason,
        finalizedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Ask error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process question. Check server logs for details.",
      question: req.body.question,
    });
  }
});

// ============================================================
// Error handlers
// ============================================================
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, error: "Internal server error" });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: "Endpoint not found", path: req.path });
});

// ============================================================
// Start
// ============================================================
app.listen(PORT, () => {
  console.log(`\n✓ PolicyBuddies Web API Server running`);
  console.log(`  Port:           ${PORT}`);
  console.log(`  Environment:    ${process.env.NODE_ENV || "development"}`);
  console.log(`  Catalog store:  ${catalogProvider}`);
  console.log(`  Vector store:   ${runtime.runtimeConfig.vectorStore?.provider ?? "file"}`);
  console.log(`  API Endpoints:`);
  console.log(`    GET  /api/health`);
  console.log(`    GET  /api/catalog`);
  console.log(`    GET  /api/config`);
  console.log(`    POST /api/ingest`);
  console.log(`    POST /api/ask\n`);
});

export default app;
