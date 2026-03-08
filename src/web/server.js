import express from "express";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
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
import { buildBusinessMetadata } from "../ingestion/metadata/businessMetadata.js";

// ── Initialise ──────────────────────────────────────────────────────────────
loadEnvFile();
const llmConfig = loadLlmConfig();
const runtime = createIngestionRuntime();

// ── Catalog store ───────────────────────────────────────────────────────────
// Configured via config/runtime.json → catalog.provider
// "file"     — default, zero dependencies, works locally
// "postgres" — requires DATABASE_URL; works on Supabase and AWS RDS
const hasDatabaseUrl = Boolean(String(process.env.DATABASE_URL ?? "").trim());
const requestedCatalogProvider = runtime.runtimeConfig.catalog?.provider ?? "file";
const catalogProvider =
  requestedCatalogProvider === "postgres" && !hasDatabaseUrl
    ? "file"
    : requestedCatalogProvider;
let catalog;
if (requestedCatalogProvider === "postgres" && !hasDatabaseUrl) {
  console.warn(
    "[server] DATABASE_URL is missing; falling back catalog store from postgres to file.",
  );
}
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

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================================
// Taxonomy
// ============================================================
app.get("/api/taxonomy", async (_req, res) => {
  try {
    const base = JSON.parse(
      readFileSync(resolve(process.cwd(), "config/taxonomy.json"), "utf8"),
    );

    // Enrich with values actually present in the catalog so the upload form
    // reflects what's already been indexed (new entries appear automatically).
    const entries = await catalog.getLatestDocuments();

    if (entries.length > 0) {
      const baseInsurerValues = new Set(base.insurers.map((i) => i.value));
      const baseTypeValues = new Set(base.insuranceTypes.map((t) => t.value));

      for (const e of entries) {
        const insurer = e.insurer ?? e.metadata?.insurer;
        if (insurer && !baseInsurerValues.has(insurer)) {
          base.insurers.push({ label: insurer, value: insurer });
          baseInsurerValues.add(insurer);
        }
        const type = e.insuranceType ?? e.metadata?.insuranceType;
        if (type && !baseTypeValues.has(type)) {
          base.insuranceTypes.push({ label: type, value: type });
          baseTypeValues.add(type);
        }
      }
    }

    res.json(base);
  } catch (err) {
    res.status(500).json({ error: "Failed to load taxonomy" });
  }
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
        insurer: doc.insurer ?? doc.metadata?.insurer ?? null,
        jurisdiction: doc.jurisdiction,
        insuranceType: doc.insuranceType ?? doc.metadata?.insuranceType ?? null,
        versionLabel: doc.versionLabel,
        documentType: doc.documentType,
        indexedAt: doc.indexedAt,
        chunkCount: doc.metadata?.chunkCount ?? null,
        vectorCount: doc.metadata?.vectorCount ?? null,
        regexTagSummary: doc.metadata?.regexTagSummary ?? null,
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
    const { insurer, planName, jurisdiction, insuranceType, documentType, versionLabel } = metadata ?? {};

    if (!filename || !content || !planName) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: filename, content, metadata.planName",
      });
    }

    // Default optional taxonomy fields so the pipeline always has valid path segments
    const resolvedInsurer = insurer || "other";
    const resolvedJurisdiction = jurisdiction || "other";
    const resolvedInsuranceType = insuranceType || "other";
    const resolvedDocumentType = documentType || "other";

    // Build structured path: data/sources/{insurer}/{jurisdiction}/{insuranceType}/{documentType}/{filename}
    const isPdf = filename.toLowerCase().endsWith(".pdf");
    const safeFilename = filename.replace(/\s+/g, "-").toLowerCase();
    const structuredPath = `data/sources/${resolvedInsurer}/${resolvedJurisdiction.toLowerCase()}/${resolvedInsuranceType}/${resolvedDocumentType}/${safeFilename}`;
    mkdirSync(resolve(process.cwd(), dirname(structuredPath)), { recursive: true });
    writeFileSync(
      resolve(process.cwd(), structuredPath),
      isPdf ? Buffer.from(content, "base64") : content,
      isPdf ? undefined : "utf8",
    );

    // ingestionService.ingest() is async to support postgres vector stores
    const ingestResult = await runtime.ingestionService.ingest({
      sourceUri: structuredPath,
      rawContent: content,
      metadata: { ...metadata, productName: planName },
      actorId,
      mimeType: isPdf ? "application/pdf" : "text/plain",
    });

    // Resolve content text for business metadata extraction:
    // PDFs → read the persisted extracted text file; text files → use content directly.
    const extractedTextPath = ingestResult.extractedTextPath ?? null;
    let contentText = "";
    if (extractedTextPath) {
      try { contentText = readFileSync(resolve(process.cwd(), extractedTextPath), "utf8"); } catch { /* leave empty */ }
    } else if (!isPdf) {
      contentText = content;
    }

    // catalog.appendEntry() is awaited — works with both file (sync) and postgres (async)
    await catalog.appendEntry({
      id: ingestResult.documentVersionId,
      sourcePath: structuredPath,
      productName: planName,
      jurisdiction: resolvedJurisdiction,
      insuranceType: resolvedInsuranceType,
      versionLabel: versionLabel || "v1.0",
      documentType: resolvedDocumentType,
      status: "completed",
      indexedAt: new Date().toISOString(),
      runId: ingestResult.runId,
      extractedTextPath,
      metadata: {
        insurer: resolvedInsurer,
        insuranceType: resolvedInsuranceType,
        planName,
        chunkCount: ingestResult.chunkCount,
        vectorCount: ingestResult.vectorCount,
        regexTagSummary: ingestResult.regexTagSummary ?? null,
        extractedTextPath,
        extractionEngine: ingestResult.extractionEngine ?? null,
        extractionStatus: ingestResult.extractionStatus ?? null,
      },
      businessMetadata: buildBusinessMetadata({
        sourcePath: structuredPath,
        metadata: { ...metadata, productName: planName },
        actorId,
        mimeType: isPdf ? "application/pdf" : "text/plain",
        contentText,
      }),
    });

    res.json({
      success: true,
      runId: ingestResult.runId,
      documentVersionId: ingestResult.documentVersionId,
      chunksGenerated: ingestResult.chunkCount,
      vectorsStored: ingestResult.vectorCount,
      regexTagSummary: ingestResult.regexTagSummary ?? null,
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
    const { question, topK = 3, productFilter } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: question",
      });
    }

    // Build question service with fresh catalog entries so newly ingested docs are included
    const allEntries = await catalog.getLatestDocuments();
    const catalogEntries =
      productFilter && productFilter !== "All Products"
        ? allEntries.filter((e) => e.productName === productFilter)
        : allEntries;
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
      sources: (qaResult.citations || []).map((c) => ({
        document: c.sourcePath?.split("/").pop() ?? c.sourcePath ?? "",
        chunk: c.chunkIndex,
        score: c.score,
        productName: c.productName,
        relevantText: c.relevantText ?? c.text ?? "",
      })),
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
// Delete document
// ============================================================
app.delete("/api/documents/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (catalogProvider === "postgres") {
      const pool = getPool();
      await pool.query("DELETE FROM document_vectors WHERE document_version_id = $1", [id]);
      const result = await pool.query("DELETE FROM ingestion_catalog WHERE id = $1", [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: "Document not found." });
      }
    } else {
      catalog.removeEntry(id);
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ success: false, error: "Failed to delete document." });
  }
});

// ============================================================
// Reindex document
// ============================================================
app.post("/api/reindex/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const entries = await catalog.getLatestDocuments();
    const entry = entries.find((e) => e.id === id);
    if (!entry) {
      return res.status(404).json({ success: false, error: "Document not found." });
    }

    const filePath = resolve(process.cwd(), entry.sourcePath);
    if (!existsSync(filePath)) {
      return res.status(422).json({
        success: false,
        error: "Source file not on disk — cannot reindex.",
        debug: { resolvedPath: filePath, sourcePath: entry.sourcePath, cwd: process.cwd() },
      });
    }

    const filename = entry.sourcePath?.split("/").pop() ?? entry.sourcePath;
    const isPdf = filename.toLowerCase().endsWith(".pdf");
    const fileBuffer = readFileSync(filePath);
    const content = isPdf ? fileBuffer.toString("base64") : fileBuffer.toString("utf8");

    // Remove old vectors before re-ingesting
    if (catalogProvider === "postgres") {
      await getPool().query("DELETE FROM document_vectors WHERE document_version_id = $1", [id]);
      await getPool().query("DELETE FROM ingestion_catalog WHERE id = $1", [id]);
    } else {
      catalog.removeEntry(id);
    }

    const ingestResult = await runtime.ingestionService.ingest({
      sourceUri: entry.sourcePath,
      rawContent: content,
      metadata: {
        productName: entry.productName,
        jurisdiction: entry.jurisdiction,
        insuranceType: entry.insuranceType ?? entry.metadata?.insuranceType ?? null,
        versionLabel: entry.versionLabel,
        documentType: entry.documentType,
      },
      actorId: "api-reindex",
      mimeType: isPdf ? "application/pdf" : "text/plain",
    });

    const reindexExtractedTextPath = ingestResult.extractedTextPath ?? null;
    const existingInsuranceType =
      entry.insuranceType ?? entry.metadata?.insuranceType ?? null;
    const existingInsurer = entry.insurer ?? entry.metadata?.insurer ?? null;
    const existingPlanName = entry.planName ?? entry.metadata?.planName ?? entry.productName;
    let reindexContentText = "";
    if (reindexExtractedTextPath) {
      try { reindexContentText = readFileSync(resolve(process.cwd(), reindexExtractedTextPath), "utf8"); } catch { /* leave empty */ }
    } else if (!isPdf) {
      reindexContentText = content;
    }

    await catalog.appendEntry({
      id: ingestResult.documentVersionId,
      sourcePath: entry.sourcePath,
      productName: entry.productName,
      jurisdiction: entry.jurisdiction,
      insuranceType: existingInsuranceType,
      versionLabel: entry.versionLabel,
      documentType: entry.documentType,
      status: "completed",
      indexedAt: new Date().toISOString(),
      runId: ingestResult.runId,
      extractedTextPath: reindexExtractedTextPath,
      metadata: {
        insurer: existingInsurer,
        insuranceType: existingInsuranceType,
        planName: existingPlanName,
        chunkCount: ingestResult.chunkCount,
        vectorCount: ingestResult.vectorCount,
        regexTagSummary: ingestResult.regexTagSummary ?? null,
        extractedTextPath: reindexExtractedTextPath,
        extractionEngine: ingestResult.extractionEngine ?? null,
        extractionStatus: ingestResult.extractionStatus ?? null,
      },
      businessMetadata: buildBusinessMetadata({
        sourcePath: entry.sourcePath,
        metadata: {
          productName: entry.productName,
          jurisdiction: entry.jurisdiction,
          insuranceType: existingInsuranceType,
          versionLabel: entry.versionLabel,
          documentType: entry.documentType,
        },
        actorId: "api-reindex",
        mimeType: isPdf ? "application/pdf" : "text/plain",
        contentText: reindexContentText,
      }),
    });

    res.json({
      success: true,
      chunksGenerated: ingestResult.chunkCount,
      vectorsStored: ingestResult.vectorCount,
      regexTagSummary: ingestResult.regexTagSummary ?? null,
    });
  } catch (error) {
    console.error("Reindex error:", error);
    res.status(500).json({ success: false, error: "Reindex failed. Check server logs." });
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
  console.log(`    GET    /api/health`);
  console.log(`    GET    /api/catalog`);
  console.log(`    GET    /api/config`);
  console.log(`    POST   /api/ingest`);
  console.log(`    POST   /api/ask`);
  console.log(`    DELETE /api/documents/:id`);
  console.log(`    POST   /api/reindex/:id\n`);
});

export default app;
