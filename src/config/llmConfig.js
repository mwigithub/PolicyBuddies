import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const LLM_CONFIG_PATH = resolve(
  process.cwd(),
  "config/llm-modules.json",
);
export const LLM_LOCAL_CONFIG_PATH = resolve(
  process.cwd(),
  "config/llm-modules.local.json",
);

export const DEFAULT_LLM_CONFIG = {
  sourceIngestion: {
    provider: "default-ingestion-provider",
    model: "rule-based-v1",
    allowPdfExtractionFallback: false,
  },
  conversation: {
    provider: "default-conversation-provider",
    model: "stub-conversation-v1",
  },
  conversationLlm: {
    provider: "ollama-conversation-provider",
    model: "llama3-lowram:latest",
    baseUrl: "http://127.0.0.1:11434",
  },
  intentRouting: {
    provider: "ollama-intent-router-provider",
    model: "llama3-lowram:latest",
    baseUrl: "http://127.0.0.1:11434",
  },
  queryPlannerLlm: {
    provider: "ollama-query-planner-provider",
    model: "llama3-lowram:latest",
    baseUrl: "http://127.0.0.1:11434",
  },
  checkerLlm: {
    provider: "ollama-checker-judge-provider",
    enabled: false,
    model: "llama3-lowram:latest",
    baseUrl: "http://127.0.0.1:11434",
  },
  confidenceReview: {
    provider: "default-review-provider",
    model: "stub-review-v1",
  },
  embedding: {
    provider: "default-embedding-provider",
    model: "nomic-embed-text",
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

export function loadLlmConfig() {
  ensureConfigDir();
  const parsed = readJson(LLM_CONFIG_PATH);
  if (!parsed) {
    saveLlmConfig(DEFAULT_LLM_CONFIG);
    return { ...DEFAULT_LLM_CONFIG };
  }
  const localOverride = readJson(LLM_LOCAL_CONFIG_PATH) ?? {};
  const merged = {
    ...parsed,
    ...localOverride,
  };

  try {
    return {
      ...DEFAULT_LLM_CONFIG,
      ...merged,
      sourceIngestion: {
        ...DEFAULT_LLM_CONFIG.sourceIngestion,
        ...(parsed.sourceIngestion ?? {}),
        ...(localOverride.sourceIngestion ?? {}),
      },
      conversation: {
        ...DEFAULT_LLM_CONFIG.conversation,
        ...(parsed.conversation ?? {}),
        ...(localOverride.conversation ?? {}),
      },
      conversationLlm: {
        ...DEFAULT_LLM_CONFIG.conversationLlm,
        ...(parsed.conversationLlm ?? {}),
        ...(localOverride.conversationLlm ?? {}),
      },
      intentRouting: {
        ...DEFAULT_LLM_CONFIG.intentRouting,
        ...(parsed.intentRouting ?? {}),
        ...(localOverride.intentRouting ?? {}),
      },
      queryPlannerLlm: {
        ...DEFAULT_LLM_CONFIG.queryPlannerLlm,
        ...(parsed.queryPlannerLlm ?? {}),
        ...(localOverride.queryPlannerLlm ?? {}),
      },
      checkerLlm: {
        ...DEFAULT_LLM_CONFIG.checkerLlm,
        ...(parsed.checkerLlm ?? {}),
        ...(localOverride.checkerLlm ?? {}),
      },
      confidenceReview: {
        ...DEFAULT_LLM_CONFIG.confidenceReview,
        ...(parsed.confidenceReview ?? {}),
        ...(localOverride.confidenceReview ?? {}),
      },
      embedding: {
        ...DEFAULT_LLM_CONFIG.embedding,
        ...(parsed.embedding ?? {}),
        ...(localOverride.embedding ?? {}),
      },
    };
  } catch {
    return { ...DEFAULT_LLM_CONFIG };
  }
}

export function saveLlmConfig(config) {
  ensureConfigDir();
  writeFileSync(LLM_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function resetLlmConfig() {
  saveLlmConfig(DEFAULT_LLM_CONFIG);
  return { ...DEFAULT_LLM_CONFIG };
}
