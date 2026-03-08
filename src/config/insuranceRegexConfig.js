import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_PATH = "config/insurance-regex-metadata.json";

function safeReadJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function toCompiledEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries
    .map((item) => {
      const id = String(item?.id ?? "").trim();
      const regex = String(item?.regex ?? "").trim();
      if (!id || !regex) {
        return null;
      }
      try {
        return {
          id,
          pattern: new RegExp(regex, "i"),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function loadInsuranceRegexMetadata(path = DEFAULT_PATH) {
  const absolutePath = resolve(process.cwd(), path);
  const parsed = safeReadJson(absolutePath);
  const catalog = parsed?.regexCatalog ?? {};
  const compiledByCategory = Object.fromEntries(
    Object.entries(catalog).map(([category, entries]) => [
      category,
      toCompiledEntries(entries),
    ]),
  );

  return {
    path,
    absolutePath,
    catalog,
    compiledByCategory,
  };
}

export function createInsuranceRegexMatcher(path = DEFAULT_PATH) {
  const metadata = loadInsuranceRegexMetadata(path);
  const byId = new Map();
  const byIdWithCategory = new Map();

  for (const [category, entries] of Object.entries(metadata.compiledByCategory)) {
    for (const entry of entries) {
      byId.set(entry.id, entry.pattern);
      byIdWithCategory.set(entry.id, { category, ...entry });
    }
  }

  const hasMatchInCategory = (text, category) => {
    const value = String(text ?? "");
    const entries = metadata.compiledByCategory[category] ?? [];
    return entries.some((item) => item.pattern.test(value));
  };

  return {
    hasMatchInCategory,
    hasMatchInAnyCategory(text, categories = []) {
      return categories.some((category) => hasMatchInCategory(text, category));
    },
    hasMatchByIds(text, ids = []) {
      const value = String(text ?? "");
      return ids.some((id) => {
        const pattern = byId.get(id);
        return pattern ? pattern.test(value) : false;
      });
    },
    matchInCategory(text, category) {
      const value = String(text ?? "");
      const entries = metadata.compiledByCategory[category] ?? [];
      return entries
        .filter((item) => item.pattern.test(value))
        .map((item) => item.id);
    },
    matchAll(text, categories = null) {
      const pickedCategories = Array.isArray(categories) && categories.length > 0
        ? categories
        : Object.keys(metadata.compiledByCategory);
      const byCategory = {};
      const matchedIds = [];
      for (const category of pickedCategories) {
        const matches = this.matchInCategory(text, category);
        if (matches.length > 0) {
          byCategory[category] = matches;
          matchedIds.push(...matches);
        }
      }
      return {
        byCategory,
        matchedIds,
        matchedCategories: Object.keys(byCategory),
      };
    },
    getEntry(id) {
      return byIdWithCategory.get(id) ?? null;
    },
    getMetadata() {
      return metadata;
    },
  };
}
