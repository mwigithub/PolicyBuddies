import { resolve } from "node:path";
import { loadLlmConfig } from "../config/llmConfig.js";
import { loadRuntimeConfig } from "../config/runtimeConfig.js";
import { createIngestionService } from "./ingestionService.js";
import { createDefaultEmbeddingProvider } from "./providers/defaultEmbeddingProvider.js";
import { createSentenceTransformerEmbeddingProvider } from "./providers/sentenceTransformerEmbeddingProvider.js";
import { createDefaultIngestionProvider } from "./providers/defaultIngestionProvider.js";
import {
  createInMemoryAuditRepository,
  createInMemoryDocumentRepository,
  createInMemoryRunRepository,
} from "./repositories/inMemoryRepositories.js";
import { createFileVectorStore } from "./vector/fileVectorStore.js";
import { createPostgresVectorStore } from "./vector/postgresVectorStore.js";
import { getPool } from "../db/pool.js";

/**
 * Bootstrap the ingestion runtime.
 *
 * Vector store selection is driven by runtime config (config/runtime.json):
 *
 *   vectorStore.provider = "file"     → local JSONL file (default, local dev)
 *   vectorStore.provider = "postgres" → PostgreSQL + pgvector (Supabase / AWS RDS)
 *
 * When using "postgres", DATABASE_URL must be set in the environment.
 * The embedding provider is selected via llm-modules.json (embedding.provider).
 */
export function createIngestionRuntime() {
  const llmConfig = loadLlmConfig();
  const runtimeConfig = loadRuntimeConfig();
  const hasDatabaseUrl = Boolean(String(process.env.DATABASE_URL ?? "").trim());
  const runRepository = createInMemoryRunRepository();
  const auditRepository = createInMemoryAuditRepository();
  const documentRepository = createInMemoryDocumentRepository();

  const ingestionProvider = createDefaultIngestionProvider({
    ...llmConfig.sourceIngestion,
    extractedTextDir: runtimeConfig.extractedTextDir,
  });

  // ── Embedding provider ──────────────────────────────────────────────────────
  // Configured via llm-modules.json → embedding.provider
  const embeddingConfig = llmConfig.embedding ?? {};
  const embeddingProvider =
    embeddingConfig.provider === "sentence-transformer-embedding-provider"
      ? createSentenceTransformerEmbeddingProvider(embeddingConfig)
      : createDefaultEmbeddingProvider(embeddingConfig);

  // ── Vector store ────────────────────────────────────────────────────────────
  // Configured via config/runtime.json → vectorStore.provider
  // "file"     — default, zero dependencies, works locally
  // "postgres" — requires DATABASE_URL; works on Supabase and AWS RDS
  const requestedVectorStoreProvider = runtimeConfig.vectorStore?.provider ?? "file";
  const vectorStoreProvider =
    requestedVectorStoreProvider === "postgres" && !hasDatabaseUrl
      ? "file"
      : requestedVectorStoreProvider;
  let vectorStore;
  if (requestedVectorStoreProvider === "postgres" && !hasDatabaseUrl) {
    console.warn(
      "[bootstrap] DATABASE_URL is missing; falling back vector store from postgres to file.",
    );
  }
  if (vectorStoreProvider === "postgres") {
    vectorStore = createPostgresVectorStore({ pool: getPool() });
    console.log("[bootstrap] Vector store: postgres (pgvector)");
  } else {
    vectorStore = createFileVectorStore({
      filePath: resolve(process.cwd(), runtimeConfig.vectorStorePath),
    });
    console.log(`[bootstrap] Vector store: file (${runtimeConfig.vectorStorePath})`);
  }

  const ingestionService = createIngestionService({
    ingestionProvider,
    embeddingProvider,
    vectorStore,
    runRepository,
    auditRepository,
    documentRepository,
    pipelineVersion: runtimeConfig.pipelineVersion,
  });

  return {
    ingestionService,
    repositories: {
      runRepository,
      auditRepository,
      documentRepository,
      vectorStore,
    },
    llmConfig,
    runtimeConfig,
  };
}
