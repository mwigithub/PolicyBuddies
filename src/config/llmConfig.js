import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const LLM_CONFIG_PATH = resolve(
  process.cwd(),
  "config/llm-modules.json",
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

export function loadLlmConfig() {
  ensureConfigDir();
  try {
    const content = readFileSync(LLM_CONFIG_PATH, "utf8");
    const parsed = JSON.parse(content);
    return {
      ...DEFAULT_LLM_CONFIG,
      ...parsed,
      sourceIngestion: {
        ...DEFAULT_LLM_CONFIG.sourceIngestion,
        ...(parsed.sourceIngestion ?? {}),
      },
      conversation: {
        ...DEFAULT_LLM_CONFIG.conversation,
        ...(parsed.conversation ?? {}),
      },
      conversationLlm: {
        ...DEFAULT_LLM_CONFIG.conversationLlm,
        ...(parsed.conversationLlm ?? {}),
      },
      intentRouting: {
        ...DEFAULT_LLM_CONFIG.intentRouting,
        ...(parsed.intentRouting ?? {}),
      },
      queryPlannerLlm: {
        ...DEFAULT_LLM_CONFIG.queryPlannerLlm,
        ...(parsed.queryPlannerLlm ?? {}),
      },
      checkerLlm: {
        ...DEFAULT_LLM_CONFIG.checkerLlm,
        ...(parsed.checkerLlm ?? {}),
      },
      confidenceReview: {
        ...DEFAULT_LLM_CONFIG.confidenceReview,
        ...(parsed.confidenceReview ?? {}),
      },
      embedding: {
        ...DEFAULT_LLM_CONFIG.embedding,
        ...(parsed.embedding ?? {}),
      },
    };
  } catch {
    saveLlmConfig(DEFAULT_LLM_CONFIG);
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
