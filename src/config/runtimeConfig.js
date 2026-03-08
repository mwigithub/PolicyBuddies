import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const RUNTIME_CONFIG_PATH = resolve(process.cwd(), "config/runtime.json");
export const RUNTIME_LOCAL_CONFIG_PATH = resolve(
  process.cwd(),
  "config/runtime.local.json",
);

export const DEFAULT_RUNTIME_CONFIG = {
  pipelineVersion: "mvp-ingestion-v1",
  vectorStorePath: "data/vector-store/vectors.jsonl",
  ingestionSourceDir: "data/sources",
  ingestionCatalogPath: "data/ingestion/catalog.json",
  extractedTextDir: "data/extracted-text",
  formulaRegistryDir: "metadata/runtime/formulas",
  formulaProductKey: null,
  formulaProductRoutingPath: "metadata/runtime/formula-product-routing.json",
  formulaSchemaPath: "metadata/runtime/formula-schema.json",
  queryRoutingPolicyPath: "metadata/runtime/query-routing-policy.json",
  intentLexiconPath: "metadata/runtime/intent-lexicon.json",
  vectorStore: {
    provider: "file", // "file" | "postgres"
  },
  catalog: {
    provider: "file", // "file" | "postgres"
  },
  planner: {
    enabled: true,
    strictRouting: false,
    llmFirst: true,
    minPlannerConfidence: 0.6,
  },
  agenticOrchestration: {
    enabled: true,
    maxClarificationTurns: 3,
    maxTotalTurns: 6,
    maxQuestionsPerTurn: 1,
    maxRetriesPerAgent: 1,
    minConfidenceToFinalize: 0.75,
    overallTimeoutMs: 30000,
  },
  demoIngestion: {
    enabled: false,
    sourceFile: "sample-policy.md",
    metadata: {
      productName: "Sample Product",
      jurisdiction: "SG",
      insuranceType: "investment-linked",
      versionLabel: "v1",
      documentType: "product summary",
    },
    actorId: "system",
    mimeType: "text/markdown",
  },
};

function ensureConfigDir() {
  mkdirSync(resolve(process.cwd(), "config"), { recursive: true });
}

function readJson(path) {
  if (!existsSync(path)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export function saveRuntimeConfig(config) {
  ensureConfigDir();
  writeFileSync(RUNTIME_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function loadRuntimeConfig() {
  ensureConfigDir();
  const parsed = readJson(RUNTIME_CONFIG_PATH);
  if (!parsed) {
    saveRuntimeConfig(DEFAULT_RUNTIME_CONFIG);
    return { ...DEFAULT_RUNTIME_CONFIG };
  }
  const localOverride = readJson(RUNTIME_LOCAL_CONFIG_PATH) ?? {};
  const merged = {
    ...parsed,
    ...localOverride,
  };

  try {
    return {
      ...DEFAULT_RUNTIME_CONFIG,
      ...merged,
      vectorStore: {
        ...DEFAULT_RUNTIME_CONFIG.vectorStore,
        ...(parsed.vectorStore ?? {}),
        ...(localOverride.vectorStore ?? {}),
      },
      catalog: {
        ...DEFAULT_RUNTIME_CONFIG.catalog,
        ...(parsed.catalog ?? {}),
        ...(localOverride.catalog ?? {}),
      },
      planner: {
        ...DEFAULT_RUNTIME_CONFIG.planner,
        ...(parsed.planner ?? {}),
        ...(localOverride.planner ?? {}),
      },
      agenticOrchestration: {
        ...DEFAULT_RUNTIME_CONFIG.agenticOrchestration,
        ...(parsed.agenticOrchestration ?? {}),
        ...(localOverride.agenticOrchestration ?? {}),
      },
      demoIngestion: {
        ...DEFAULT_RUNTIME_CONFIG.demoIngestion,
        ...(parsed.demoIngestion ?? {}),
        ...(localOverride.demoIngestion ?? {}),
        metadata: {
          ...DEFAULT_RUNTIME_CONFIG.demoIngestion.metadata,
          ...(parsed.demoIngestion?.metadata ?? {}),
          ...(localOverride.demoIngestion?.metadata ?? {}),
        },
      },
    };
  } catch {
    return { ...DEFAULT_RUNTIME_CONFIG };
  }
}
