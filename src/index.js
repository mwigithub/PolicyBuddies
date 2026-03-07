import { createIngestionRuntime } from "./ingestion/bootstrap.js";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { createFileIngestionCatalog } from "./ingestion/catalog/fileIngestionCatalog.js";
import { loadMetadataRuntimeConfig } from "./config/metadataRuntimeConfig.js";
import { buildBusinessMetadata } from "./ingestion/metadata/businessMetadata.js";
import { sha256 } from "./ingestion/utils.js";

const appName = "PolicyBuddies";

const runtime = createIngestionRuntime();
const metadataRuntimeConfig = loadMetadataRuntimeConfig();
const demo = runtime.runtimeConfig.demoIngestion;
const catalog = createFileIngestionCatalog({
  catalogPath: runtime.runtimeConfig.ingestionCatalogPath,
});

console.log(`${appName} initialised.`);
console.log("Loaded LLM Config:", runtime.llmConfig);
console.log("Loaded Runtime Config:", runtime.runtimeConfig);

if (demo.enabled) {
  const sourceDir =
    process.env.INGESTION_SOURCE_DIR || runtime.runtimeConfig.ingestionSourceDir;
  const sourceFile = process.env.DEMO_SOURCE_FILE || demo.sourceFile;
  const sourcePath = resolve(process.cwd(), sourceDir, sourceFile);
  const rawContent = readFileSync(sourcePath, "utf8");

  const ingestResult = runtime.ingestionService.ingest({
    sourceUri: sourcePath,
    rawContent,
    metadata: {
      productName: process.env.DEMO_PRODUCT_NAME || demo.metadata.productName,
      jurisdiction:
        process.env.DEMO_JURISDICTION || demo.metadata.jurisdiction,
      versionLabel:
        process.env.DEMO_VERSION_LABEL || demo.metadata.versionLabel,
      documentType:
        process.env.DEMO_DOCUMENT_TYPE || demo.metadata.documentType,
    },
    actorId: process.env.DEMO_ACTOR_ID || demo.actorId,
    mimeType: process.env.DEMO_MIME_TYPE || demo.mimeType,
  });
  const mappedContentText = ingestResult.extractedTextPath
    ? readFileSync(
      resolve(process.cwd(), ingestResult.extractedTextPath),
      "utf8",
    )
    : rawContent;
  catalog.appendEntry({
    runId: ingestResult.runId,
    sourcePath: relative(process.cwd(), sourcePath),
    sourceHash: sha256(rawContent),
    status: ingestResult.status,
    documentVersionId: ingestResult.documentVersionId,
    extractedTextPath: ingestResult.extractedTextPath,
    extractionStatus: ingestResult.extractionStatus,
    extractionEngine: ingestResult.extractionEngine,
    tableCount: ingestResult.tableCount,
    chunkingMode: ingestResult.chunkingMode,
    minChunkTokens: ingestResult.minChunkTokens,
    maxChunkTokens: ingestResult.maxChunkTokens,
    productName: process.env.DEMO_PRODUCT_NAME || demo.metadata.productName,
    versionLabel: process.env.DEMO_VERSION_LABEL || demo.metadata.versionLabel,
    jurisdiction: process.env.DEMO_JURISDICTION || demo.metadata.jurisdiction,
    documentType:
      process.env.DEMO_DOCUMENT_TYPE || demo.metadata.documentType,
    metadataStandardVersion: metadataRuntimeConfig.metadataStandardVersion,
    businessMetadata: buildBusinessMetadata({
      sourcePath: relative(process.cwd(), sourcePath),
      metadata: {
        productName: process.env.DEMO_PRODUCT_NAME || demo.metadata.productName,
        versionLabel: process.env.DEMO_VERSION_LABEL || demo.metadata.versionLabel,
        jurisdiction: process.env.DEMO_JURISDICTION || demo.metadata.jurisdiction,
        documentType:
          process.env.DEMO_DOCUMENT_TYPE || demo.metadata.documentType,
      },
      actorId: process.env.DEMO_ACTOR_ID || demo.actorId,
      mimeType: process.env.DEMO_MIME_TYPE || demo.mimeType,
      contentText: mappedContentText,
    }),
  });

  console.log("Ingestion Result:", ingestResult);
  console.log(
    "Document Versions:",
    runtime.repositories.documentRepository.listVersions(),
  );
  console.log(
    "Audit Trail:",
    runtime.repositories.auditRepository.listByRunId(ingestResult.runId),
  );
  console.log(
    "Vector File:",
    runtime.repositories.vectorStore.getFilePath(),
  );
  console.log(
    "Stored Vectors:",
    runtime.repositories.vectorStore.listVectorsByDocumentVersion(
      ingestResult.documentVersionId,
    ),
  );
}
