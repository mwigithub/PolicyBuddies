import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { sha256 } from "../utils.js";

function looksLikePdf({ sourceUri, mimeType }) {
  return String(mimeType || "").toLowerCase().includes("pdf") ||
    extname(sourceUri).toLowerCase() === ".pdf";
}

function extractTextWithPython(sourcePath) {
  try {
    const scriptPath = resolve(process.cwd(), "scripts/pdf_to_text.py");
    const stdout = execFileSync("python3", [scriptPath, sourcePath], {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      timeout: 60_000,
    });
    const parsed = JSON.parse(stdout);
    if (!parsed.ok) {
      return {
        ok: false,
        text: "",
        engine: "python-unavailable",
        error: parsed.error || "unknown error",
      };
    }
    return {
      ok: true,
      text: String(parsed.text || ""),
      engine: String(parsed.engine || "python"),
      tableCount: Number(parsed.table_count || 0),
    };
  } catch (error) {
    return {
      ok: false,
      text: "",
      engine: "python-unavailable",
      error: error instanceof Error ? error.message : String(error),
      tableCount: 0,
    };
  }
}

function extractTextFallback(rawContent) {
  const matches = rawContent.match(/[A-Za-z0-9][\x20-\x7E]{20,}/g) || [];
  return matches.join("\n");
}

function persistExtractedText(text, extractedTextDir, sourceUri, rawContent) {
  const id = sha256(`${sourceUri}:${sha256(rawContent)}`).slice(0, 20);
  const filePath = resolve(process.cwd(), extractedTextDir, `${id}.txt`);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${text}\n`, "utf8");
  return filePath.replace(`${process.cwd()}/`, "");
}

export function createDefaultIngestionProvider(config = {}) {
  const providerName = config.provider ?? "default-ingestion-provider";
  const modelName = config.model ?? "rule-based-v1";
  const extractedTextDir = config.extractedTextDir ?? "data/extracted-text";
  const allowPdfExtractionFallback = Boolean(config.allowPdfExtractionFallback);

  return {
    name: providerName,
    model: modelName,
    extractStructuredContent(input) {
      if (looksLikePdf({ sourceUri: input.sourceUri, mimeType: input.mimeType })) {
        const pythonResult = extractTextWithPython(
          resolve(process.cwd(), input.sourceUri),
        );
        if (!pythonResult.ok && !allowPdfExtractionFallback) {
          throw new Error(
            `PDF extraction failed for ${input.sourceUri}: ${pythonResult.error}`,
          );
        }
        const extractedText = pythonResult.ok
          ? pythonResult.text
          : extractTextFallback(input.rawContent);
        const extractedTextPath = persistExtractedText(
          extractedText,
          extractedTextDir,
          input.sourceUri,
          input.rawContent,
        );

        return {
          normalizedText: extractedText.trim(),
          normalizedMetadata: {
            ...input.metadata,
            normalizedBy: providerName,
            extractedTextPath,
            extractionEngine: pythonResult.ok ? pythonResult.engine : "fallback-regex",
            extractionStatus: pythonResult.ok ? "success" : "fallback",
            extractionError: pythonResult.ok ? null : pythonResult.error,
            tableCount: pythonResult.tableCount ?? 0,
          },
        };
      }

      return {
        normalizedText: input.rawContent.trim(),
        normalizedMetadata: {
          ...input.metadata,
          normalizedBy: providerName,
          extractedTextPath: null,
          extractionEngine: "not-required",
          extractionStatus: "success",
          extractionError: null,
          tableCount: 0,
        },
      };
    },
  };
}
