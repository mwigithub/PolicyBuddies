import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, resolve, relative } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadRuntimeConfig } from "../config/runtimeConfig.js";
import { loadMetadataRuntimeConfig } from "../config/metadataRuntimeConfig.js";
import { createIngestionRuntime } from "../ingestion/bootstrap.js";
import { createFileIngestionCatalog } from "../ingestion/catalog/fileIngestionCatalog.js";
import { buildBusinessMetadata } from "../ingestion/metadata/businessMetadata.js";
import { sha256 } from "../ingestion/utils.js";

const DOCUMENT_TYPES = [
  "product illustration",
  "product summary",
  "product brochure",
];

function listSourceFiles(sourceDirAbsolute) {
  const files = [];
  const stack = [sourceDirAbsolute];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) {
      continue;
    }
    const entries = readdirSync(currentDir)
      .filter((name) => !name.startsWith("."))
      .sort((a, b) => a.localeCompare(b));

    for (const entryName of entries) {
      const absolutePath = resolve(currentDir, entryName);
      const stats = statSync(absolutePath);
      if (stats.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (stats.isFile()) {
        files.push(absolutePath);
      }
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function printAvailableSources(sourceDirAbsolute) {
  const files = listSourceFiles(sourceDirAbsolute);
  console.log("\nAvailable Source Documents");
  console.log("==========================");
  if (files.length === 0) {
    console.log("No files found in source folder.\n");
    return;
  }

  files.forEach((absolutePath, index) => {
    const relPath = relative(process.cwd(), absolutePath);
    const fileSize = statSync(absolutePath).size;
    console.log(`${index + 1}) ${relPath} (${fileSize} bytes)`);
  });
  console.log("");
}

function printNewOrChanged(rows) {
  console.log("\nNew/Changed Source Documents");
  console.log("============================");
  const candidates = rows.filter((row) => row.status === "NEW" || row.status === "CHANGED");
  if (candidates.length === 0) {
    console.log("No NEW/CHANGED documents.\n");
    return [];
  }

  candidates.forEach((row, index) => {
    const latest = row.latestEntry
      ? `lastRun=${row.latestEntry.runId} at ${row.latestEntry.ingestedAt}`
      : "never ingested";
    console.log(`${index + 1}) [${row.status}] ${row.sourcePath} (${latest})`);
  });
  console.log("");
  return candidates;
}

function detectStatus(latestEntry, sourceHash) {
  if (!latestEntry) {
    return "NEW";
  }
  if (latestEntry.sourceHash !== sourceHash) {
    return "CHANGED";
  }
  return "INGESTED";
}

function buildCrossReference({ sourceDirAbsolute, catalog }) {
  return listSourceFiles(sourceDirAbsolute).map((absolutePath) => {
    const content = readFileSync(absolutePath, "utf8");
    const sourceHash = sha256(content);
    const sourcePath = relative(process.cwd(), absolutePath);
    const latestEntry = catalog.getLatestEntryBySource(sourcePath);
    const status = detectStatus(latestEntry, sourceHash);
    return {
      sourcePath,
      sourceHash,
      status,
      latestEntry,
    };
  });
}

function printCrossReference(rows) {
  console.log("\nSource Cross Reference");
  console.log("======================");
  if (rows.length === 0) {
    console.log("No source files found.\n");
    return;
  }

  rows.forEach((row, index) => {
    const latest = row.latestEntry
      ? `lastRun=${row.latestEntry.runId} at ${row.latestEntry.ingestedAt}`
      : "never ingested";
    console.log(`${index + 1}) [${row.status}] ${row.sourcePath} (${latest})`);
  });
  console.log("");
}

async function askMetadata(rl, fileName) {
  const defaultProduct = basename(fileName).replace(/\.[^.]+$/, "");
  const productName = (
    await rl.question(`Product name [${defaultProduct}]: `)
  ).trim() || defaultProduct;
  const versionLabel = (await rl.question("Version label [v1]: ")).trim() || "v1";
  const jurisdiction = (await rl.question("Jurisdiction [SG]: ")).trim() || "SG";
  const actorId = (await rl.question("Actor ID [system]: ")).trim() || "system";
  const mimeType = (
    await rl.question("Mime type [text/markdown]: ")
  ).trim() || "text/markdown";
  console.log("\nDocument Type:");
  DOCUMENT_TYPES.forEach((value, index) => {
    console.log(`${index + 1}) ${value}`);
  });
  const typeRaw = (await rl.question("Select type number [1]: ")).trim() || "1";
  const typeIndex = Number(typeRaw);
  const documentType =
    Number.isNaN(typeIndex) || typeIndex < 1 || typeIndex > DOCUMENT_TYPES.length
      ? DOCUMENT_TYPES[0]
      : DOCUMENT_TYPES[typeIndex - 1];

  return {
    metadata: { productName, versionLabel, jurisdiction, documentType },
    actorId,
    mimeType,
  };
}

async function ingestOne({ rl, runtime, catalog, sourceDirAbsolute, sourcePath }) {
  const metadataRuntimeConfig = loadMetadataRuntimeConfig();
  const absolutePath = resolve(process.cwd(), sourcePath);
  const fileName = relative(sourceDirAbsolute, absolutePath);
  const rawContent = readFileSync(absolutePath, "utf8");
  const sourceHash = sha256(rawContent);
  const values = await askMetadata(rl, fileName);
  const stageLabel = {
    run_started: "Run created",
    source_hashed: "Source hashed",
    source_saved: "Source metadata saved",
    normalized: "Content normalized",
    version_saved: "Version saved",
    chunked: "Chunks generated",
    vectors_stored: "Vectors persisted",
    run_completed: "Run completed",
    run_failed: "Run failed",
  };

  console.log(`\nIngestion Process: ${sourcePath}`);
  console.log("--------------------------------");

  const result = runtime.ingestionService.ingest({
    sourceUri: sourcePath,
    rawContent,
    metadata: values.metadata,
    actorId: values.actorId,
    mimeType: values.mimeType,
    onProgress: (event) => {
      const label = stageLabel[event.stage] ?? event.stage;
      if (event.stage === "source_hashed") {
        console.log(`- ${label}: ${event.sourceHash.slice(0, 16)}...`);
        return;
      }
      if (event.stage === "chunked") {
        const mode = event.chunkingMode ?? "unknown";
        console.log(
          `- ${label}: ${event.chunkCount} (mode=${mode}, min=${event.minChunkTokens ?? 0}, max=${event.maxChunkTokens ?? 0})`,
        );
        return;
      }
      if (event.stage === "vectors_stored") {
        console.log(`- ${label}: ${event.vectorCount}`);
        return;
      }
      if (event.stage === "version_saved") {
        const previous = event.previousDocumentVersionId ?? "none";
        console.log(`- ${label}: ${event.documentVersionId} (prev: ${previous})`);
        return;
      }
      if (event.stage === "run_failed") {
        console.log(`- ${label}: ${event.errorMessage}`);
        return;
      }
      if (event.stage === "run_started") {
        console.log(`- ${label}: ${event.runId}`);
        return;
      }
      console.log(`- ${label}`);
    },
  });

  const mappedContentText = result.extractedTextPath
    ? readFileSync(resolve(process.cwd(), result.extractedTextPath), "utf8")
    : rawContent;

  catalog.appendEntry({
    runId: result.runId,
    sourcePath,
    sourceHash,
    status: result.status,
    documentVersionId: result.documentVersionId,
    extractedTextPath: result.extractedTextPath,
    extractionStatus: result.extractionStatus,
    extractionEngine: result.extractionEngine,
    tableCount: result.tableCount,
    chunkingMode: result.chunkingMode,
    minChunkTokens: result.minChunkTokens,
    maxChunkTokens: result.maxChunkTokens,
    productName: values.metadata.productName,
    versionLabel: values.metadata.versionLabel,
    jurisdiction: values.metadata.jurisdiction,
    documentType: values.metadata.documentType,
    metadataStandardVersion: metadataRuntimeConfig.metadataStandardVersion,
    businessMetadata: buildBusinessMetadata({
      sourcePath,
      metadata: values.metadata,
      actorId: values.actorId,
      mimeType: values.mimeType,
      contentText: mappedContentText,
    }),
  });

  console.log(`Result: Ingested ${sourcePath} with run ${result.runId}\n`);
}

function printMenu() {
  console.log("PolicyBuddies Ingestion Terminal");
  console.log("================================");
  console.log("1) List NEW/CHANGED source documents");
  console.log("2) List all available source documents");
  console.log("3) Ingest all NEW/CHANGED documents");
  console.log("4) Ingest selected NEW/CHANGED document");
  console.log("5) Show ingestion history");
  console.log("6) Exit");
}

export async function runIngestionUi() {
  const runtimeConfig = loadRuntimeConfig();
  const runtime = createIngestionRuntime();
  const sourceDirAbsolute = resolve(process.cwd(), runtimeConfig.ingestionSourceDir);
  const catalog = createFileIngestionCatalog({
    catalogPath: runtimeConfig.ingestionCatalogPath,
  });
  const rl = createInterface({ input, output });

  let done = false;
  while (!done) {
    printMenu();
    const selected = (await rl.question("Select option: ")).trim();

    if (selected === "1") {
      const rows = buildCrossReference({ sourceDirAbsolute, catalog });
      printNewOrChanged(rows);
      continue;
    }

    if (selected === "2") {
      printAvailableSources(sourceDirAbsolute);
      continue;
    }

    if (selected === "3") {
      const rows = buildCrossReference({ sourceDirAbsolute, catalog });
      const candidates = printNewOrChanged(rows);
      if (candidates.length === 0) {
        continue;
      }

      for (const row of candidates) {
        console.log(`Preparing ingestion for ${row.sourcePath}`);
        await ingestOne({
          rl,
          runtime,
          catalog,
          sourceDirAbsolute,
          sourcePath: row.sourcePath,
        });
      }
      continue;
    }

    if (selected === "4") {
      const rows = buildCrossReference({ sourceDirAbsolute, catalog });
      const candidates = printNewOrChanged(rows);
      if (candidates.length === 0) {
        continue;
      }
      const indexRaw = (await rl.question("NEW/CHANGED document number to ingest: ")).trim();
      const index = Number(indexRaw);
      if (Number.isNaN(index) || index < 1 || index > candidates.length) {
        console.log("Invalid selection.\n");
        continue;
      }

      await ingestOne({
        rl,
        runtime,
        catalog,
        sourceDirAbsolute,
        sourcePath: candidates[index - 1].sourcePath,
      });
      continue;
    }

    if (selected === "5") {
      const entries = catalog.listEntries();
      console.log("\nIngestion History");
      console.log("=================");
      if (entries.length === 0) {
        console.log("No ingestion history found.\n");
        continue;
      }
      entries.forEach((entry, index) => {
        console.log(
          `${index + 1}) ${entry.ingestedAt} | run=${entry.runId} | ${entry.sourcePath} | ${entry.status} | ${entry.productName}/${entry.versionLabel}/${entry.jurisdiction} | ${entry.documentType ?? "unknown"} | extract=${entry.extractionStatus ?? "unknown"}(${entry.extractionEngine ?? "n/a"}) tables=${entry.tableCount ?? 0} | chunk=${entry.chunkingMode ?? "n/a"}:${entry.minChunkTokens ?? 0}-${entry.maxChunkTokens ?? 0}`,
        );
      });
      console.log("");
      continue;
    }

    if (selected === "6") {
      done = true;
      continue;
    }

    console.log("Invalid option.\n");
  }

  rl.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runIngestionUi();
}
