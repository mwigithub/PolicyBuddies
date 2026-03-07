import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  collectLexiconMatches,
  normalizeQuestionWithLexicon,
} from "./intentLexiconRuntime.js";

function safeReadJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function detectIntent(question, lexicon = null) {
  const normalization = normalizeQuestionWithLexicon(question, lexicon);
  const text = normalization.normalizedQuestion;
  const lexiconMatches = collectLexiconMatches(text, lexicon);
  const hasInsuranceSignal =
    lexiconMatches.exactMatches.length > 0 || lexiconMatches.fuzzyMatches.length > 0;
  if (
    /\bcompare|difference between|versus|vs\.\b/.test(text)
  ) {
    return "comparison";
  }
  if (/\bbasic plan|plan name|name of (the )?plan\b/.test(text)) {
    return "structured_lookup";
  }
  if (hasInsuranceSignal) {
    return "structured_lookup";
  }
  if (
    /\benhanced.*rider|rider benefit|rider coverage|waiver of premium|tpd|critical illness|critical+ illness|covered illness|rider\b/.test(
      text,
    )
  ) {
    return "structured_lookup";
  }
  if (
    /\bbenefit|death benefit|maturity benefit|surrender value|cash value|sum assured|coverage term|policy term|issue age|premium payment term\b/.test(
      text,
    )
  ) {
    return "structured_lookup";
  }
  if (
    /\bexclusion|waiting period|eligibility|qualify|claim|claims process|claim document|claim submission|termination|lapse|reinstatement\b/.test(
      text,
    )
  ) {
    return "structured_lookup";
  }
  if (
    /\bpremium mode|modal premium|premium frequency|premium paid|paid to-date|paid to date|charges|fees|distribution cost\b/.test(
      text,
    )
  ) {
    return "structured_lookup";
  }
  if (
    /\b(loyalty|performance|power[- ]?up|initial)\s+bonus\b/.test(text) &&
    /\bcompute|calculate|formula|amount|value\b/.test(text)
  ) {
    return "calculation";
  }
  if (
    /\bcalculate|compute|formula|projection|projected|simulate|illustrated at|4%|8%\b/.test(
      text,
    )
  ) {
    return "calculation";
  }
  if (/\bwhat is|define|meaning of\b/.test(text)) {
    return "definition";
  }
  if (/\bwhy|how does|explain|walk me through\b/.test(text)) {
    return "explanatory";
  }
  return "explanatory";
}

function defaultPlan(question, lexicon = null) {
  const normalization = normalizeQuestionWithLexicon(question, lexicon);
  const lexiconMatches = collectLexiconMatches(normalization.normalizedQuestion, lexicon);
  const intentClass = detectIntent(normalization.normalizedQuestion, lexicon);
  return {
    intentClass,
    intent: intentClass,
    preferredDocumentTypes: [],
    preferredChunkKinds: [],
    topK: 5,
    tierUsed: "strict",
    plannerSource: "rule",
    plannerConfidence: 1,
    queryNormalization: normalization,
    lexiconMatches,
  };
}

function buildLexiconHints(lexiconMatches) {
  const all = [
    ...(lexiconMatches?.exactMatches ?? []),
    ...(lexiconMatches?.fuzzyMatches ?? []),
  ];
  const preferredDocumentTypes = new Set();
  const preferredChunkKinds = new Set();
  const intentSignals = new Set();
  for (const item of all) {
    for (const value of item.documentHints ?? []) {
      preferredDocumentTypes.add(String(value).toLowerCase());
    }
    for (const value of item.chunkHints ?? []) {
      preferredChunkKinds.add(String(value).toLowerCase());
    }
    for (const signal of item.intentSignals ?? []) {
      intentSignals.add(String(signal).toLowerCase());
    }
  }
  return {
    preferredDocumentTypes: [...preferredDocumentTypes],
    preferredChunkKinds: [...preferredChunkKinds],
    intentSignals: [...intentSignals],
    hasHints: all.length > 0,
  };
}

export function createIntentQueryPlanner({
  policyPath = "metadata/runtime/query-routing-policy.json",
  llmPlannerProvider = null,
  llmFirst = false,
  minPlannerConfidence = 0.6,
  intentLexicon = null,
} = {}) {
  const resolvedPath = resolve(process.cwd(), policyPath);
  const policy = safeReadJson(resolvedPath);

  return {
    getPolicy() {
      return policy;
    },
    async plan({
      question,
      strictRouting = false,
    }) {
      let base = defaultPlan(question, intentLexicon);
      const lexiconHints = buildLexiconHints(base.lexiconMatches);
      if (
        lexiconHints.hasHints &&
        lexiconHints.intentSignals.includes("structured_lookup")
      ) {
        base = {
          ...base,
          intentClass: "structured_lookup",
          intent: "structured_lookup",
          plannerSource:
            base.plannerSource === "rule" ? "rule_lexicon" : base.plannerSource,
        };
      }
      if (llmFirst && llmPlannerProvider?.classify) {
        try {
          const llm = await llmPlannerProvider.classify({ question });
          if (
            llm?.intentClass &&
            Number(llm?.confidence ?? 0) >= Number(minPlannerConfidence)
          ) {
            base = {
              ...base,
              intentClass: llm.intentClass,
              intent: llm.intentClass,
              plannerSource: "llm",
              plannerConfidence: Number(llm.confidence),
            };
          } else {
            base = {
              ...base,
              plannerSource: "rule_fallback_low_confidence",
              plannerConfidence: Number(llm?.confidence ?? 0),
            };
          }
        } catch {
          base = {
            ...base,
            plannerSource: "rule_fallback_error",
            plannerConfidence: 0,
          };
        }
      }
      if (!policy || !Array.isArray(policy.rules)) {
        return base;
      }

      const intentClass = base.intentClass;
      const text = String(base.queryNormalization?.normalizedQuestion ?? question ?? "").toLowerCase();
      let rule = policy.rules.find((item) => {
        if ((item.intentClass ?? "") !== intentClass) {
          return false;
        }
        const patterns = Array.isArray(item.whenAnyRegex) ? item.whenAnyRegex : [];
        if (patterns.length === 0) {
          return true;
        }
        return patterns.some((pattern) => new RegExp(pattern, "i").test(text));
      });
      if (!rule) {
        rule = policy.rules.find((item) => (item.intentClass ?? "") === intentClass);
      }
      const plan = {
        intentClass,
        intent: intentClass,
        preferredDocumentTypes: rule?.preferredDocumentTypes ?? [],
        preferredChunkKinds: rule?.preferredChunkKinds ?? [],
        topK: Number(rule?.topK ?? policy.defaultTopK ?? base.topK),
        strictRouting: Boolean(strictRouting),
        fallbackTiers: policy.fallbackTiers ?? ["strict"],
        tierUsed: "strict",
        plannerSource: base.plannerSource,
        plannerConfidence: base.plannerConfidence,
        queryNormalization: base.queryNormalization,
        lexiconMatches: base.lexiconMatches,
      };
      if (lexiconHints.hasHints) {
        const lexiconHasCriticalList = lexiconHints.preferredChunkKinds.includes(
          "critical_illness_list",
        );
        if (lexiconHasCriticalList) {
          plan.preferredDocumentTypes =
            lexiconHints.preferredDocumentTypes.length > 0
              ? [...new Set(lexiconHints.preferredDocumentTypes)]
              : plan.preferredDocumentTypes;
          plan.preferredChunkKinds = [...new Set(lexiconHints.preferredChunkKinds)];
        } else {
          const docs = new Set([
            ...plan.preferredDocumentTypes.map((item) => String(item).toLowerCase()),
            ...lexiconHints.preferredDocumentTypes,
          ]);
          const chunks = new Set([
            ...plan.preferredChunkKinds.map((item) => String(item).toLowerCase()),
            ...lexiconHints.preferredChunkKinds,
          ]);
          plan.preferredDocumentTypes = [...docs];
          plan.preferredChunkKinds = [...chunks];
        }
        if (lexiconHints.preferredChunkKinds.includes("critical_illness_list")) {
          plan.topK = Math.max(plan.topK, 10);
        }
      }

      return plan;
    },
  };
}
