import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { loadRuntimeConfig } from "../src/config/runtimeConfig.js";

function listExistingSources(sourceDirAbsolute) {
  const stack = [sourceDirAbsolute];
  const sources = new Set();

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
        sources.add(relative(process.cwd(), absolutePath));
      }
    }
  }

  return sources;
}

function main() {
  const runtimeConfig = loadRuntimeConfig();
  const sourceDir = resolve(process.cwd(), runtimeConfig.ingestionSourceDir);
  const catalogPath = resolve(process.cwd(), runtimeConfig.ingestionCatalogPath);
  const vectorPath = resolve(process.cwd(), runtimeConfig.vectorStorePath);

  const existingSources = listExistingSources(sourceDir);
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  const versionToSource = new Map();

  for (const entry of catalog.entries ?? []) {
    if (entry.documentVersionId && entry.sourcePath) {
      versionToSource.set(entry.documentVersionId, entry.sourcePath);
    }
  }

  const lines = readFileSync(vectorPath, "utf8").split("\n").filter(Boolean);
  const kept = [];
  const removedBySource = new Map();

  for (const line of lines) {
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }

    const sourcePath = versionToSource.get(record.documentVersionId);
    if (!sourcePath || existingSources.has(sourcePath)) {
      kept.push(JSON.stringify(record));
      continue;
    }

    removedBySource.set(sourcePath, (removedBySource.get(sourcePath) ?? 0) + 1);
  }

  writeFileSync(
    vectorPath,
    `${kept.join("\n")}${kept.length > 0 ? "\n" : ""}`,
    "utf8",
  );

  const summary = {
    sourceDir: runtimeConfig.ingestionSourceDir,
    vectorStorePath: runtimeConfig.vectorStorePath,
    before: lines.length,
    after: kept.length,
    removedTotal: lines.length - kept.length,
    removedBySource: Object.fromEntries(removedBySource),
  };

  console.log(JSON.stringify(summary, null, 2));
}

main();
