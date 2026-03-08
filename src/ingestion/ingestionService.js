import {
  chunkText,
  generateId,
  generateRunId,
  nowIso,
  sha256,
} from "./utils.js";
import { extname } from "node:path";
import { createInsuranceRegexMatcher } from "../config/insuranceRegexConfig.js";

const insuranceRegexMatcher = createInsuranceRegexMatcher();
const CHUNK_REGEX_CATEGORIES = [
  "productTypes",
  "benefits",
  "chargesAndFees",
  "claimsAndEligibility",
  "policyLifecycle",
  "projectionsAndPar",
];

function tagChunkWithInsuranceRegex(chunkText) {
  const matchResult = insuranceRegexMatcher.matchAll(
    chunkText,
    CHUNK_REGEX_CATEGORIES,
  );
  return {
    categories: matchResult.matchedCategories,
    ids: matchResult.matchedIds,
    byCategory: matchResult.byCategory,
  };
}

function summarizeChunkRegexTags(chunks = []) {
  const categoryCounts = {};
  const idCounts = {};
  let matchedChunkCount = 0;

  for (const chunk of chunks) {
    const tags = chunk?.regexTags ?? tagChunkWithInsuranceRegex(chunk?.chunkText ?? "");
    if (!tags || !Array.isArray(tags.categories) || tags.categories.length === 0) {
      continue;
    }
    matchedChunkCount += 1;

    for (const category of tags.categories) {
      categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
    }
    for (const id of tags.ids ?? []) {
      idCounts[id] = (idCounts[id] ?? 0) + 1;
    }
  }

  return {
    matchedChunkCount,
    categories: Object.keys(categoryCounts).sort(),
    categoryCounts,
    idCounts,
  };
}

function createRun({ actorId, provider, pipelineVersion }) {
  return {
    runId: generateRunId(),
    actorId,
    pipelineVersion,
    providerName: provider.name,
    providerModel: provider.model,
    status: "started",
    startedAt: nowIso(),
    completedAt: null,
    errorCode: null,
    errorMessage: null,
  };
}

export function createIngestionService({
  ingestionProvider,
  embeddingProvider,
  vectorStore,
  runRepository,
  auditRepository,
  documentRepository,
  pipelineVersion,
}) {
  const isPdfSource = ({ sourceUri, mimeType }) =>
    String(mimeType || "").toLowerCase().includes("pdf") ||
    extname(String(sourceUri || "")).toLowerCase() === ".pdf";

  return {
    async ingest({
      sourceUri,
      rawContent,
      metadata,
      actorId,
      mimeType,
      onProgress,
    }) {
      const report = (stage, details = {}) => {
        if (typeof onProgress === "function") {
          onProgress({ stage, ...details });
        }
      };

      const run = createRun({
        actorId,
        provider: ingestionProvider,
        pipelineVersion,
      });
      runRepository.create(run);
      report("run_started", { runId: run.runId });

      const emitAudit = (eventType, payload) =>
        auditRepository.append({
          auditEventId: generateId("AUD"),
          runId: run.runId,
          eventType,
          eventTimestamp: nowIso(),
          actorId,
          payload,
        });

      emitAudit("run_started", { pipelineVersion });

      try {
        const sourceHash = sha256(rawContent);
        report("source_hashed", { sourceHash });
        const existingVersion = documentRepository.findExistingVersion({
          productName: metadata.productName,
          jurisdiction: metadata.jurisdiction,
          versionLabel: metadata.versionLabel,
          documentType: metadata.documentType,
          sourceHash,
        });
        if (existingVersion) {
          const existingChunks = documentRepository.listChunks(
            existingVersion.documentVersionId,
          );
          const regexTagSummary = summarizeChunkRegexTags(existingChunks);
          const chunkTokenCounts = existingChunks.map((chunk) => chunk.tokenEstimate);
          const normalizedDocument = documentRepository.getNormalizedDocument(
            existingVersion.documentVersionId,
          );
          const chunkingMode = existingChunks[0]?.chunkingMode ??
            (isPdfSource({ sourceUri, mimeType }) ? "section" : "line");
          emitAudit("idempotent_reused", {
            documentVersionId: existingVersion.documentVersionId,
            sourceHash,
          });
          runRepository.updateStatus(run.runId, {
            status: "completed",
            completedAt: nowIso(),
          });
          report("run_completed", { runId: run.runId, idempotent: true });
          emitAudit("run_completed", { status: "completed", idempotent: true });
          return {
            runId: run.runId,
            sourceHash,
            documentVersionId: existingVersion.documentVersionId,
            chunkCount: existingChunks.length,
            vectorCount: existingChunks.length,
            chunkingMode,
            minChunkTokens: chunkTokenCounts.length > 0 ? Math.min(...chunkTokenCounts) : 0,
            maxChunkTokens: chunkTokenCounts.length > 0 ? Math.max(...chunkTokenCounts) : 0,
            regexTagSummary,
            extractedTextPath:
              normalizedDocument?.normalizationMetadata?.extractedTextPath ?? null,
            extractionStatus:
              normalizedDocument?.normalizationMetadata?.extractionStatus ?? "unknown",
            extractionEngine:
              normalizedDocument?.normalizationMetadata?.extractionEngine ?? "unknown",
            tableCount:
              normalizedDocument?.normalizationMetadata?.tableCount ?? 0,
            status: "completed",
            idempotent: true,
          };
        }
        const sourceDocument = {
          sourceDocumentId: generateId("SRC"),
          sourceUri,
          sourceHash,
          mimeType,
          rawContent,
          createdAt: nowIso(),
        };
        documentRepository.saveSourceDocument(sourceDocument);
        report("source_saved", {
          sourceDocumentId: sourceDocument.sourceDocumentId,
        });
        emitAudit("source_attached", {
          sourceDocumentId: sourceDocument.sourceDocumentId,
          sourceHash,
        });

        const previous = documentRepository.findLatestVersion({
          productName: metadata.productName,
          jurisdiction: metadata.jurisdiction,
        });

        const normalized = ingestionProvider.extractStructuredContent({
          sourceUri,
          rawContent,
          metadata,
        });
        report("normalized", {
          providerName: run.providerName,
          providerModel: run.providerModel,
        });
        emitAudit("normalized", {
          providerName: run.providerName,
          providerModel: run.providerModel,
        });

        const documentVersion = {
          documentVersionId: generateId("VER"),
          productName: metadata.productName,
          jurisdiction: metadata.jurisdiction,
          versionLabel: metadata.versionLabel,
          documentType: metadata.documentType,
          sourceDocumentId: sourceDocument.sourceDocumentId,
          previousDocumentVersionId: previous?.documentVersionId ?? null,
          runId: run.runId,
          status: "active",
          createdAt: nowIso(),
        };

        documentRepository.saveDocumentVersion(documentVersion);
        report("version_saved", {
          documentVersionId: documentVersion.documentVersionId,
          previousDocumentVersionId: previous?.documentVersionId ?? null,
        });

        const normalizedDocument = {
          normalizedDocumentId: generateId("NORM"),
          documentVersionId: documentVersion.documentVersionId,
          normalizedText: normalized.normalizedText,
          normalizationMetadata: normalized.normalizedMetadata,
          createdAt: nowIso(),
        };
        documentRepository.saveNormalizedDocument(normalizedDocument);

        const chunkingMode = isPdfSource({ sourceUri, mimeType }) ? "section" : "line";
        const chunks = chunkText(
          normalized.normalizedText,
          chunkingMode === "section"
            ? {
              mode: "section",
              minTokens: 200,
              targetTokens: 650,
              maxTokens: 800,
              overlapTokens: 120,
            }
            : {
              mode: "line",
              linesPerChunk: 5,
            },
        ).map(
          (chunkValue, index) => ({
            chunkId: generateId("CHK"),
            documentVersionId: documentVersion.documentVersionId,
            runId: run.runId,
            chunkIndex: index,
            chunkText: chunkValue,
            chunkHash: sha256(chunkValue),
            tokenEstimate: chunkValue.split(/\s+/).filter(Boolean).length,
            regexTags: tagChunkWithInsuranceRegex(chunkValue),
            chunkingMode,
            createdAt: nowIso(),
          }),
        );
        const regexTagSummary = summarizeChunkRegexTags(chunks);
        const chunkTokenCounts = chunks.map((chunk) => chunk.tokenEstimate);
        const chunkStats = {
          chunkCount: chunks.length,
          minChunkTokens: chunkTokenCounts.length > 0 ? Math.min(...chunkTokenCounts) : 0,
          maxChunkTokens: chunkTokenCounts.length > 0 ? Math.max(...chunkTokenCounts) : 0,
          chunkingMode,
        };
        documentRepository.saveChunks(chunks);
        report("chunked", chunkStats);
        emitAudit("chunked", chunkStats);
        report("regex_tagged", regexTagSummary);
        emitAudit("regex_tagged", regexTagSummary);

        // Use embedBatch when available (single subprocess call) for performance;
        // fall back to per-chunk embedText for providers that don't support batching.
        const chunkTexts = chunks.map((chunk) => chunk.chunkText);
        const vectors = embeddingProvider.embedBatch
          ? await embeddingProvider.embedBatch(chunkTexts)
          : await Promise.all(chunkTexts.map((text) => embeddingProvider.embedText(text)));

        const vectorRecords = chunks.map((chunk, i) => ({
          vectorRecordId: generateId("VEC"),
          runId: run.runId,
          documentVersionId: documentVersion.documentVersionId,
          chunkId: chunk.chunkId,
          chunkText: chunk.chunkText ?? null,
          embeddingProviderName: embeddingProvider.name,
          embeddingProviderModel: embeddingProvider.model,
          vector: vectors[i],
          createdAt: nowIso(),
        }));
        await vectorStore.appendVectors(vectorRecords);
        report("vectors_stored", { vectorCount: vectorRecords.length });
        emitAudit("vectors_stored", {
          vectorCount: vectorRecords.length,
          storeType: "file-jsonl",
        });
        if (previous) {
          documentRepository.markSuperseded(previous.documentVersionId);
        }

        runRepository.updateStatus(run.runId, {
          status: "completed",
          completedAt: nowIso(),
        });
        report("run_completed", { runId: run.runId });
        emitAudit("run_completed", { status: "completed" });

        return {
          runId: run.runId,
          sourceHash,
          documentVersionId: documentVersion.documentVersionId,
          chunkCount: chunks.length,
          vectorCount: vectorRecords.length,
          chunkingMode,
          minChunkTokens: chunkStats.minChunkTokens,
          maxChunkTokens: chunkStats.maxChunkTokens,
          regexTagSummary,
          extractedTextPath:
            normalized.normalizedMetadata?.extractedTextPath ?? null,
          extractionStatus:
            normalized.normalizedMetadata?.extractionStatus ?? "unknown",
          extractionEngine:
            normalized.normalizedMetadata?.extractionEngine ?? "unknown",
          tableCount:
            normalized.normalizedMetadata?.tableCount ?? 0,
          status: "completed",
        };
      } catch (error) {
        report("run_failed", {
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        runRepository.updateStatus(run.runId, {
          status: "failed",
          completedAt: nowIso(),
          errorCode: "INGESTION_ERROR",
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        emitAudit("run_failed", {
          errorCode: "INGESTION_ERROR",
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  };
}
