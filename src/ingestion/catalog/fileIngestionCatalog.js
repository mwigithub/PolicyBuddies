import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { nowIso } from "../utils.js";

function ensureCatalogFile(filePath) {
  const absolute = resolve(process.cwd(), filePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, "", { flag: "a" });
  if (readFileSync(absolute, "utf8").trim() === "") {
    writeFileSync(absolute, `${JSON.stringify({ entries: [] }, null, 2)}\n`, "utf8");
  }
  return absolute;
}

function readCatalog(absolutePath) {
  try {
    const parsed = JSON.parse(readFileSync(absolutePath, "utf8"));
    if (!Array.isArray(parsed.entries)) {
      return { entries: [] };
    }
    return parsed;
  } catch {
    return { entries: [] };
  }
}

function writeCatalog(absolutePath, payload) {
  writeFileSync(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export function createFileIngestionCatalog({ catalogPath }) {
  const absolutePath = ensureCatalogFile(catalogPath);

  return {
    getPath() {
      return absolutePath;
    },

    listEntries() {
      return readCatalog(absolutePath).entries.map((entry) => {
        const metadata = entry.metadata ?? {};
        return {
          // Ensure every entry has the fields questionService expects
          status: "completed",
          ingestedAt: entry.ingestedAt ?? entry.indexedAt ?? nowIso(),
          insuranceType: entry.insuranceType ?? metadata.insuranceType ?? null,
          insurer: entry.insurer ?? metadata.insurer ?? null,
          planName: entry.planName ?? metadata.planName ?? null,
          ...entry,
        };
      });
    },

    // Alias used by server.js — identical to listEntries for the file provider
    getLatestDocuments() {
      return this.listEntries();
    },

    listEntriesBySource(sourcePath) {
      return this.listEntries().filter((entry) => entry.sourcePath === sourcePath);
    },

    getLatestEntryBySource(sourcePath) {
      const entries = this.listEntriesBySource(sourcePath).sort((a, b) =>
        a.ingestedAt.localeCompare(b.ingestedAt),
      );
      return entries.length === 0 ? null : entries[entries.length - 1];
    },

    appendEntry(entry) {
      const payload = readCatalog(absolutePath);
      const now = nowIso();
      payload.entries.push({
        status: "completed",
        ...entry,
        ingestedAt: entry.ingestedAt ?? entry.indexedAt ?? now,
      });
      writeCatalog(absolutePath, payload);
    },

    removeEntry(id) {
      const payload = readCatalog(absolutePath);
      payload.entries = payload.entries.filter((e) => e.id !== id);
      writeCatalog(absolutePath, payload);
    },
  };
}
