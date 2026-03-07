import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const DEFAULT_INTENT_LEXICON = {
  version: "1.0.0",
  language: "en",
  domains: ["life-insurance"],
  terms: [
    {
      canonicalTerm: "critical illness",
      intentSignals: ["structured_lookup"],
      synonyms: ["covered critical illnesses", "critical illness coverage"],
      abbreviations: ["ci"],
      misspellings: ["criticall illness", "critcal illness", "critical illnes"],
      documentHints: ["product summary"],
      chunkHints: ["critical_illness_list", "text", "table"],
    },
    {
      canonicalTerm: "rider benefit",
      intentSignals: ["structured_lookup"],
      synonyms: ["rider coverage", "enhanced rider benefit", "waiver of premium rider"],
      abbreviations: [],
      misspellings: ["raider benefit", "rider benfit"],
      documentHints: ["product summary", "product brochure"],
      chunkHints: ["metadata", "text"],
    },
    {
      canonicalTerm: "sum assured",
      intentSignals: ["structured_lookup", "definition"],
      synonyms: ["basic sum assured"],
      abbreviations: ["sa"],
      misspellings: ["sum asured", "sum assuredd"],
      documentHints: ["product summary", "policy illustration"],
      chunkHints: ["metadata", "text", "table"],
    },
    {
      canonicalTerm: "surrender value",
      intentSignals: ["structured_lookup", "calculation"],
      synonyms: ["cash value", "policy value"],
      abbreviations: [],
      misspellings: ["surrendar value", "surrender valu"],
      documentHints: ["policy illustration", "product summary"],
      chunkHints: ["table", "text", "metadata"],
    },
    {
      canonicalTerm: "premium paid to date",
      intentSignals: ["structured_lookup", "calculation"],
      synonyms: ["total premium paid", "premiums paid to-date"],
      abbreviations: [],
      misspellings: ["premiun paid", "premium payed"],
      documentHints: ["policy illustration"],
      chunkHints: ["table", "text", "formula"],
    },
    {
      canonicalTerm: "exclusion",
      intentSignals: ["structured_lookup"],
      synonyms: ["policy exclusion", "not covered"],
      abbreviations: [],
      misspellings: ["exlusion", "excluson"],
      documentHints: ["product summary", "product brochure"],
      chunkHints: ["text", "metadata"],
    },
    {
      canonicalTerm: "waiting period",
      intentSignals: ["structured_lookup"],
      synonyms: ["deferment period"],
      abbreviations: [],
      misspellings: ["waitting period", "waiting peroid"],
      documentHints: ["product summary", "product brochure"],
      chunkHints: ["text", "metadata"],
    },
    {
      canonicalTerm: "claim process",
      intentSignals: ["structured_lookup", "explanatory"],
      synonyms: ["how to claim", "claim submission", "claim documents"],
      abbreviations: [],
      misspellings: ["cliam process", "claim proccess"],
      documentHints: ["product summary", "product brochure"],
      chunkHints: ["text", "metadata"],
    },
  ],
};

function ensureLexiconFile(path) {
  const absolute = resolve(process.cwd(), path);
  mkdirSync(dirname(absolute), { recursive: true });
  try {
    readFileSync(absolute, "utf8");
  } catch {
    writeFileSync(
      absolute,
      `${JSON.stringify(DEFAULT_INTENT_LEXICON, null, 2)}\n`,
      "utf8",
    );
  }
  return absolute;
}

export function loadIntentLexicon(path = "metadata/runtime/intent-lexicon.json") {
  const absolute = ensureLexiconFile(path);
  try {
    const parsed = JSON.parse(readFileSync(absolute, "utf8"));
    return {
      ...DEFAULT_INTENT_LEXICON,
      ...parsed,
      terms: Array.isArray(parsed.terms) ? parsed.terms : DEFAULT_INTENT_LEXICON.terms,
    };
  } catch {
    return { ...DEFAULT_INTENT_LEXICON };
  }
}

export function saveIntentLexicon(path = "metadata/runtime/intent-lexicon.json", payload = {}) {
  const absolute = ensureLexiconFile(path);
  const normalized = {
    ...DEFAULT_INTENT_LEXICON,
    ...payload,
    terms: Array.isArray(payload.terms) ? payload.terms : [],
  };
  writeFileSync(absolute, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}

