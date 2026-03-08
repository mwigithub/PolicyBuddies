import { extname, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import {
  collectLexiconMatches,
  normalizeQuestionWithLexicon,
} from "./intentLexiconRuntime.js";
import { buildQueryChunks, WEALTH_PRO_PROFILE_ID } from "../chunking/index.js";
import { createInsuranceRegexMatcher } from "../config/insuranceRegexConfig.js";

const TEXT_EXTENSIONS = new Set([".md", ".markdown", ".txt", ".text", ".csv"]);
const insuranceRegexMatcher = createInsuranceRegexMatcher();

// Common function words that carry no domain meaning and inflate relevance
// scores when matched against policy document chunks.
const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "to", "of", "in", "on",
  "at", "by", "for", "with", "about", "as", "into", "from",
  "if", "or", "and", "but", "what", "which", "who", "whom",
  "this", "that", "these", "those", "it", "its", "how", "when",
  "where", "why", "so", "not", "no", "nor", "up", "out",
  "me", "my", "we", "our", "you", "your", "he", "she", "they",
  "them", "their", "i", "get", "got", "just", "also", "very",
  "there", "here", "then", "than", "do",
]);

const TABLE_INTENT_TOKENS = new Set([
  "table",
  "row",
  "rows",
  "column",
  "columns",
]);
const FORMULA_INTENT_TOKENS = new Set([
  "formula",
  "formulas",
  "calculate",
  "calculation",
  "computed",
  "compute",
  "higher",
  "lower",
  "multiplied",
  "multiply",
  "percentage",
  "rate",
  "charge",
  "charges",
  "deduction",
  "deductions",
  "bonus",
  "loyalty",
  "performance",
  "power",
  "initial",
]);

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function canonicalDocumentType(value) {
  const text = normalize(value).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text) {
    return "";
  }
  if (text.includes("summary")) {
    return "summary";
  }
  if (text.includes("illustration")) {
    return "illustration";
  }
  if (text.includes("brochure")) {
    return "brochure";
  }
  if (text.includes("wording")) {
    return "wording";
  }
  if (text.includes("benefit schedule")) {
    return "benefit schedule";
  }
  return text;
}

function normalizeToken(token) {
  let stem;
  if (token.length > 5 && token.endsWith("ing")) {
    stem = token.slice(0, -3);
  } else if (token.length > 4 && token.endsWith("ed")) {
    stem = token.slice(0, -2);
  } else if (token.length > 4 && token.endsWith("es")) {
    stem = token.slice(0, -2);
  } else if (token.length > 3 && token.endsWith("s")) {
    stem = token.slice(0, -1);
  } else {
    return token;
  }
  return stem.length >= 3 ? stem : token;
}

function tokenize(text) {
  return normalize(text)
    .split(/\W+/)
    .filter((token) => token.length >= 2)
    .map(normalizeToken)
    .filter((token) => token.length >= 2);
}

function computeEntryAffinityBoost(question, entry) {
  const normalizedQuestion = normalize(question);
  const productName = normalize(entry?.productName ?? "");
  const sourcePath = normalize(entry?.sourcePath ?? "");
  if (!normalizedQuestion || !productName) {
    return 0;
  }

  if (normalizedQuestion.includes(productName)) {
    return 0.55;
  }

  const stop = new Set(["plan", "product", "policy", "tm"]);
  const productTokens = tokenize(productName).filter(
    (token) => token.length >= 3 && !stop.has(token),
  );
  if (productTokens.length === 0) {
    return 0;
  }

  const matched = productTokens.filter((token) =>
    normalizedQuestion.includes(token),
  ).length;
  if (matched === 0) {
    return 0;
  }
  if (matched === productTokens.length && matched >= 2) {
    return 0.45;
  }
  if (matched >= 2) {
    return 0.35;
  }
  if (sourcePath && productTokens.some((token) => sourcePath.includes(token))) {
    return 0.2;
  }
  return 0.15;
}

function hasTableIntent(questionTokens, question) {
  if (/\btable|row|column\b/i.test(question)) {
    return true;
  }
  return questionTokens.some((token) => TABLE_INTENT_TOKENS.has(token));
}

function hasFormulaIntent(questionTokens, question) {
  if (/\bformula|calculate|calculation|computed|higher of|lower of|multipl(?:y|ied)|bonus\b/i.test(question)) {
    return true;
  }
  if (/[=÷×+\-/*]/.test(question) || /\d+%/.test(question)) {
    return true;
  }
  return questionTokens.some((token) => FORMULA_INTENT_TOKENS.has(token));
}

function detectScopeHint(question) {
  const text = normalize(question);
  if (text.includes("product summary")) {
    return "product summary";
  }
  if (text.includes("policy illustration")) {
    return "policy illustration";
  }
  if (text.includes("product brochure")) {
    return "product brochure";
  }
  if (text.includes("fact find")) {
    return "fact find";
  }
  return null;
}

function detectRoutingHints(questionTokens, question) {
  const hasInsuranceLookupSignal = insuranceRegexMatcher.hasMatchInAnyCategory(
    question,
    ["benefits", "chargesAndFees", "claimsAndEligibility", "policyLifecycle"],
  );
  const tableIntent = hasTableIntent(questionTokens, question);
  const formulaIntent = hasFormulaIntent(questionTokens, question);
  const metadataIntent =
    /\beligible|eligibility|bonus list|list of bonus|bonus|rider|benefit|coverage|sum assured|exclusion|waiting period|claim|surrender value|premium mode\b/i.test(
      question,
    ) || hasInsuranceLookupSignal;
  const riderIntent =
    /\benhanced.*rider|rider benefit|rider coverage|benefit.*rider|waiver of premium|TPD|critical illness|critical+ illness|rider\b/i.test(
      question,
    ) ||
    insuranceRegexMatcher.hasMatchByIds(question, [
      "lifecycle_rider",
      "lifecycle_waiver",
      "lifecycle_tpd",
    ]);
  const criticalIllnessListIntent =
    /\b(40|forty).*(critical illness(?:es)?|critical+ illness(?:es)?|covered critical illnesses?)|critical illness(?:es)?\s+list|covered critical illness(?:es)?|critical illness(?:es)?.*covered.*rider|critical illness(?:es)?.*rider\b|critical+ illness(?:es)?.*rider\b/i.test(
      question,
    );
  const waitingPeriodIntent =
    /\bwaiting period|deferment period\b/i.test(question) ||
    insuranceRegexMatcher.hasMatchByIds(question, [
      "clm_waiting_period",
      "clm_elimination_period",
    ]);
  const sumAssuredIntent =
    /\bsum assured|basic sum assured\b/i.test(question) ||
    insuranceRegexMatcher.hasMatchByIds(question, ["bnf_sum_assured"]);
  const premiumPaidYearIntent =
    /\b(total )?premium(s)? paid|paid to-?date\b/i.test(question) &&
    /\byear\b/i.test(question);
  const explicitScopeHint = detectScopeHint(question);
  let inferredScopeHint = explicitScopeHint;
  if (!inferredScopeHint) {
    if (
      riderIntent ||
      criticalIllnessListIntent ||
      waitingPeriodIntent ||
      sumAssuredIntent
    ) {
      inferredScopeHint = "product summary";
    } else if (premiumPaidYearIntent || tableIntent || formulaIntent) {
      inferredScopeHint = "policy illustration";
    }
  }

  return {
    tableIntent,
    formulaIntent,
    metadataIntent,
    riderIntent,
    criticalIllnessListIntent,
    waitingPeriodIntent,
    sumAssuredIntent,
    premiumPaidYearIntent,
    scopeHint: inferredScopeHint,
  };
}

function entryMatchesScope(entry, scopeHint) {
  if (!scopeHint) {
    return true;
  }
  const source = normalize(entry.sourcePath);
  const product = normalize(entry.productName);
  const type = canonicalDocumentType(entry.documentType);
  if (scopeHint === "product summary") {
    return (
      source.includes("product summary") ||
      source.includes("product-summary") ||
      product.includes("product summary") ||
      type.includes("summary")
    );
  }
  if (scopeHint === "policy illustration") {
    return (
      source.includes("policy illustration") ||
      source.includes("policy-illustration") ||
      product.includes("policy illustration") ||
      type.includes("illustration")
    );
  }
  if (scopeHint === "fact find") {
    return source.includes("fact find") || product.includes("fact find");
  }
  if (scopeHint === "product brochure") {
    return source.includes("brochure") || product.includes("brochure") || type.includes("brochure");
  }
  return (
    source.includes(scopeHint) ||
    product.includes(scopeHint) ||
    type.includes(scopeHint)
  );
}

function scoreChunk(questionTokens, chunkText, options = {}) {
  const {
    kind = "text",
    tableIntent = false,
    formulaIntent = false,
    metadataIntent = false,
    bonusComputationIntent = false,
    planNameIntent = false,
    riderIntent = false,
    criticalIllnessListIntent = false,
    waitingPeriodIntent = false,
    sumAssuredIntent = false,
    premiumPaidYearIntent = false,
    documentType = "",
    scopeMatched = true,
  } = options;
  const chunkTokens = [...new Set(tokenize(chunkText))];
  if (questionTokens.length === 0 || chunkTokens.length === 0) {
    return 0;
  }

  const tokenMatches = (left, right) => {
    if (left === right) {
      return true;
    }
    if (left.length >= 4 && right.length >= 4) {
      let prefix = 0;
      const limit = Math.min(left.length, right.length);
      for (let i = 0; i < limit; i += 1) {
        if (left[i] !== right[i]) {
          break;
        }
        prefix += 1;
      }
      if (prefix >= 4) {
        return true;
      }
    }
    return false;
  };

  let overlap = 0;
  for (const questionToken of questionTokens) {
    if (chunkTokens.some((chunkToken) => tokenMatches(questionToken, chunkToken))) {
      overlap += 1;
    }
  }
  let score = overlap / questionTokens.length;

  if (kind === "table" && tableIntent) {
    score = Math.max(score, 0.08) + 0.35;
  }
  if (kind === "formula" && formulaIntent) {
    score = Math.max(score, 0.08) + 0.45;
  }
  if (kind === "metadata" && metadataIntent) {
    score = Math.max(score, 0.1) + 0.55;
  }
  if (bonusComputationIntent) {
    const normalizedDocType = normalize(documentType);
    if (kind === "metadata") {
      score += 0.45;
    } else if (kind === "formula") {
      score -= 0.12;
    }
    if (normalizedDocType.includes("summary")) {
      score += 0.35;
    }
    if (normalizedDocType.includes("illustration")) {
      score -= 0.35;
    }
  }
  if (planNameIntent) {
    const normalizedText = String(chunkText ?? "");
    if (/basic plan\s*:|plan name\s*:|basic plan\s*\n\s*:/i.test(normalizedText)) {
      score += 0.85;
    } else if (!/basic plan|plan name/i.test(normalizedText)) {
      score -= 0.25;
    }
  }
  if (riderIntent) {
    const normalizedText = String(chunkText ?? "");
    if (
      /rider name\s*:|benefit type\s*:|coverage triggers\s*:|enhanced payer benefit rider|waiver of premium/i.test(
        normalizedText,
      )
    ) {
      score += 0.75;
    } else if (!/rider|waiver|tpd|critical illness/i.test(normalizedText)) {
      score -= 0.2;
    }
  }
  if (criticalIllnessListIntent) {
    const normalizedText = String(chunkText ?? "");
    if (kind === "critical_illness_list") {
      score += 1;
    } else if (kind === "table" || kind === "text") {
      if (/table\s*1\s*:\s*40\s*covered\s*critical\s*illnesses|covered critical illnesses?/i.test(normalizedText)) {
        score += 0.8;
      } else if (/critical illness|critical illnesses/i.test(normalizedText)) {
        score += 0.35;
      } else {
        score -= 0.2;
      }
    } else if (kind === "metadata") {
      if (/bonus type:|rate:|eligible from:|eligible to:|formula:/i.test(normalizedText)) {
        score -= 0.85;
      } else if (/rider name:|coverage triggers:/i.test(normalizedText)) {
        score += 0.1;
      } else {
        score -= 0.2;
      }
    }
  }
  if (waitingPeriodIntent) {
    const normalizedText = String(chunkText ?? "");
    const normalizedDocType = normalize(documentType);
    if (normalizedDocType.includes("summary")) {
      score += 0.45;
    } else if (normalizedDocType.includes("illustration")) {
      score -= 0.3;
    }
    if (/waiting period|deferment period|within\s+\d+\s+days/i.test(normalizedText)) {
      score += kind === "metadata" ? 0.5 : 0.9;
    } else if (
      kind === "metadata" &&
      !/waiting period days:|waiting period scope:|waiting period conditions:/i.test(
        normalizedText,
      )
    ) {
      score -= 0.95;
    } else if (kind === "formula" || kind === "table") {
      score -= 0.65;
    } else if (/bonus type:|rate:|eligible from:|eligible to:|formula:/i.test(normalizedText)) {
      score -= 0.9;
    }
  }
  if (sumAssuredIntent) {
    const normalizedText = String(chunkText ?? "");
    if (/sum assured|basic sum assured/i.test(normalizedText)) {
      score += kind === "metadata" ? 0.95 : 0.65;
    } else if (/bonus type:|rate:|eligible from:|eligible to:|formula:/i.test(normalizedText)) {
      score -= 0.9;
    }
  }
  if (premiumPaidYearIntent) {
    const normalizedText = String(chunkText ?? "");
    if (
      kind === "table" &&
      /total premiums paid to-?date|premiums paid to-?date|end of policy year/i.test(
        normalizedText,
      )
    ) {
      score += 1.25;
    } else if (
      kind === "metadata" &&
      /premium paid to-?date by policy year:|policy year\s+\d+\s*:/i.test(
        normalizedText,
      )
    ) {
      score += 1.35;
    } else if (
      kind === "formula"
    ) {
      score -= 1.25;
    } else if (
      kind === "metadata" &&
      /bonus type:|rate:|eligible from:|eligible to:|formula:/i.test(normalizedText)
    ) {
      score -= 0.85;
    }
  }
  if (!scopeMatched) {
    score -= 0.55;
  }

  return Math.min(score, 1);
}

function chunkKindRank(kind) {
  if (kind === "metadata") {
    return 0;
  }
  if (kind === "critical_illness_list") {
    return 1;
  }
  if (kind === "formula") {
    return 2;
  }
  if (kind === "table") {
    return 3;
  }
  return 4;
}

function latestCompletedEntries(entries) {
  const map = new Map();

  for (const entry of entries.filter((item) => item.status === "completed")) {
    const prev = map.get(entry.sourcePath);
    if (!prev || prev.ingestedAt < entry.ingestedAt) {
      map.set(entry.sourcePath, entry);
    }
  }

  return [...map.values()];
}

function matchFilters(entry, filters) {
  if (!filters) {
    return true;
  }
  if (filters.productName && normalize(entry.productName) !== normalize(filters.productName)) {
    return false;
  }
  if (filters.versionLabel && normalize(entry.versionLabel) !== normalize(filters.versionLabel)) {
    return false;
  }
  if (filters.jurisdiction && normalize(entry.jurisdiction) !== normalize(filters.jurisdiction)) {
    return false;
  }
  if (filters.documentType && normalize(entry.documentType) !== normalize(filters.documentType)) {
    return false;
  }
  return true;
}

function isInformationNotFoundAnswer(answer) {
  const text = normalize(answer);
  return (
    text.includes("information not found") ||
    text.includes("to be defined") ||
    text.includes("insufficient information")
  );
}

function hasProductSpecificConstraint(question) {
  const text = normalize(question);
  return (
    /\bthis product|this policy|this rider|in this plan|for this plan|for this rider|under this policy\b/.test(
      text,
    ) ||
    /\bpolicy year|\byear\s*\d+|\b10th year|\bcoverage commencement|\breinstatement\b/.test(
      text,
    ) ||
    /\bfor wealth pro|wealth pro|product summary|policy illustration|product brochure\b/.test(
      text,
    )
  );
}

function resolveAnswerStrategy({
  question,
  answer,
  confidenceScore,
  intentRouting,
  queryPlan,
  evidence,
}) {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    return {
      mode: "stochastic",
      sourcePreference: "industry",
      reason: "no_evidence",
    };
  }

  if (isInformationNotFoundAnswer(answer)) {
    return {
      mode: "stochastic",
      sourcePreference: "industry",
      reason: "insufficient_deterministic_signal",
    };
  }

  const intentClass = normalize(queryPlan?.intentClass);
  const productSpecificConstraint = hasProductSpecificConstraint(question);
  if (intentClass === "definition" && !productSpecificConstraint) {
    return {
      mode: "stochastic",
      sourcePreference: "industry",
      reason: "industry_definition_intent",
    };
  }

  const deterministicIntent =
    Boolean(intentRouting?.waitingPeriodIntent) ||
    Boolean(intentRouting?.sumAssuredIntent) ||
    Boolean(intentRouting?.premiumPaidYearIntent) ||
    Boolean(intentRouting?.criticalIllnessListIntent) ||
    Boolean(intentRouting?.riderIntent);

  if (deterministicIntent && Number(confidenceScore ?? 0) >= 0.25) {
    return {
      mode: "deterministic",
      sourcePreference: "evidence",
      reason: "domain_policy_lookup",
    };
  }

  return {
    mode: "stochastic",
    sourcePreference: "industry",
    reason: "open_ended_or_low_confidence",
  };
}

function extractCanonicalTerms(lexiconMatches = null) {
  const exact = Array.isArray(lexiconMatches?.exactMatches)
    ? lexiconMatches.exactMatches
    : [];
  const fuzzy = Array.isArray(lexiconMatches?.fuzzyMatches)
    ? lexiconMatches.fuzzyMatches
    : [];
  const terms = new Set();
  for (const item of [...exact, ...fuzzy]) {
    const term = normalize(item?.canonicalTerm);
    if (term) {
      terms.add(term);
    }
  }
  return [...terms];
}

function buildIndustryDefinitionAnswer({ queryPlan, lexiconMatches }) {
  const intentClass = normalize(queryPlan?.intentClass);
  const terms = extractCanonicalTerms(lexiconMatches);
  const supportsDefinitionIntent =
    intentClass === "definition" || terms.length > 0;
  if (!supportsDefinitionIntent) {
    return null;
  }
  if (terms.includes("sum assured")) {
    return [
      "Direct Answer:",
      "In life insurance, sum assured is the guaranteed base amount the insurer agrees to pay when a covered insured event occurs (such as death or maturity, subject to policy terms).",
      "",
      "Evidence Highlights:",
      "- This is an industry definition answer selected by intent routing.",
      "- Product-specific numeric sum assured is not available in the currently retrieved policy metadata.",
    ].join("\n");
  }
  if (terms.includes("waiting period")) {
    return [
      "Direct Answer:",
      "In insurance, waiting period is the time after policy or rider commencement during which specified claims or benefits are not payable.",
      "",
      "Evidence Highlights:",
      "- This is an industry definition answer selected by intent routing.",
      "- Product-specific waiting period details are provided separately when asked as a policy lookup.",
    ].join("\n");
  }
  return null;
}

function buildMetadataChunks(entry) {
  const planName =
    entry.businessMetadata?.coreMetadata?.product?.productLevel?.planName ??
    entry.businessMetadata?.product?.productLevel?.planName ??
    null;
  const bonuses =
    entry.businessMetadata?.productMetadata?.data?.benefitAttributes?.bonuses ??
    entry.businessMetadata?.benefitAttributes?.bonuses ??
    [];
  const sumAssured =
    entry.businessMetadata?.productMetadata?.data?.benefitAttributes?.sumAssured ??
    entry.businessMetadata?.benefitAttributes?.sumAssured ??
    null;
  const riders =
    entry.businessMetadata?.productMetadata?.data?.riderAttributes?.riders ??
    entry.businessMetadata?.riderAttributes?.riders ??
    [];
  const waitingPeriod =
    entry.businessMetadata?.productMetadata?.data?.riderAttributes?.waitingPeriod ??
    entry.businessMetadata?.riderAttributes?.waitingPeriod ??
    null;
  const premiumPaidToDateByPolicyYear =
    entry.businessMetadata?.productMetadata?.data?.benefitAttributes
      ?.premiumPaidToDateByPolicyYear?.records ??
    entry.businessMetadata?.benefitAttributes?.premiumPaidToDateByPolicyYear
      ?.records ??
    [];

  const chunks = [];
  if (planName) {
    const lines = [
      `Plan Name: ${planName}`,
      `Document Type: ${entry.documentType ?? "unknown"}`,
      `Source: ${entry.sourcePath}`,
    ];
    chunks.push({
      chunkIndex: chunks.length + 1,
      lineStart: 1,
      lineEnd: lines.length,
      text: lines.join("\n"),
      kind: "metadata",
    });
  }
  if (sumAssured) {
    const lines = [
      `Sum Assured: ${sumAssured.amount ?? "to be defined"}`,
      `Currency: ${sumAssured.currency ?? "to be defined"}`,
      `Basis: ${sumAssured.basis ?? "to be defined"}`,
      `Document Type: ${entry.documentType ?? "unknown"}`,
      `Source: ${entry.sourcePath}`,
    ];
    chunks.push({
      chunkIndex: chunks.length + 1,
      lineStart: 1,
      lineEnd: lines.length,
      text: lines.join("\n"),
      kind: "metadata",
    });
  }

  if (Array.isArray(bonuses) && bonuses.length > 0) {
    for (const bonus of bonuses) {
      const rate =
        bonus.rate !== null && bonus.rate !== undefined
          ? `${(Number(bonus.rate) * 100).toFixed(2)}%`
          : "to be defined";
      const lines = [
        `Bonus Type: ${bonus.bonusType ?? "unknown"}`,
        `Formula: ${bonus.formulaExpression ?? "to be defined"}`,
        `Rate: ${rate}`,
        `Eligible From: ${bonus.appliesFrom ?? "to be defined"}`,
        `Eligible To: ${bonus.appliesTo ?? "to be defined"}`,
        `Confidence: ${bonus.parserConfidence ?? "unknown"}`,
      ];
      chunks.push({
        chunkIndex: chunks.length + 1,
        lineStart: 1,
        lineEnd: lines.length,
        text: lines.join("\n"),
        kind: "metadata",
      });
    }
  }

  for (const rider of Array.isArray(riders) ? riders : []) {
    const lines = [
      `Rider Name: ${rider.riderName ?? "unknown"}`,
      `Benefit Type: ${rider.benefitType ?? "to be defined"}`,
      `Coverage Triggers: ${(rider.coverageTriggers ?? []).join(", ") || "to be defined"}`,
      `Coverage Term: ${rider.coverageTerm ?? "to be defined"}`,
      `Has Surrender Value: ${rider.hasSurrenderValue ?? "to be defined"}`,
      `Premium Rate Guarantee: ${rider.premiumRateGuarantee ?? "to be defined"}`,
      `Benefit Summary: ${rider.benefitSummary ?? "to be defined"}`,
      `Confidence: ${rider.parserConfidence ?? "unknown"}`,
    ];
    chunks.push({
      chunkIndex: chunks.length + 1,
      lineStart: 1,
      lineEnd: lines.length,
      text: lines.join("\n"),
      kind: "metadata",
    });
  }

  if (waitingPeriod && waitingPeriod.exists) {
    const lines = [
      `Waiting Period Days: ${waitingPeriod.periodDays ?? "to be defined"}`,
      `Waiting Period Scope: ${waitingPeriod.scope ?? "to be defined"}`,
      `Waiting Period Conditions: ${(waitingPeriod.conditions ?? []).join("; ") || "to be defined"}`,
      `Confidence: ${waitingPeriod.parserConfidence ?? "unknown"}`,
      `Document Type: ${entry.documentType ?? "unknown"}`,
      `Source: ${entry.sourcePath}`,
    ];
    chunks.push({
      chunkIndex: chunks.length + 1,
      lineStart: 1,
      lineEnd: lines.length,
      text: lines.join("\n"),
      kind: "metadata",
    });
  }

  if (Array.isArray(premiumPaidToDateByPolicyYear) && premiumPaidToDateByPolicyYear.length > 0) {
    const lines = [
      "Premium Paid To-Date by Policy Year:",
      ...premiumPaidToDateByPolicyYear.map((row) =>
        `Policy Year ${row.policyYear}: ${row.totalPremiumPaidToDate}${
          row.ageNextBirthday ? ` (Age NB ${row.ageNextBirthday})` : ""
        }`,
      ),
      `Document Type: ${entry.documentType ?? "unknown"}`,
      `Source: ${entry.sourcePath}`,
    ];
    chunks.push({
      chunkIndex: chunks.length + 1,
      lineStart: 1,
      lineEnd: lines.length,
      text: lines.join("\n"),
      kind: "metadata",
    });
  }

  return chunks;
}

export function createQuestionService({
  catalogEntries,
  conversationProvider,
  reviewProvider,
  intentRouter,
  queryPlanner,
  plannerOptions = {},
  intentLexicon = null,
  semanticReranker = null,
}) {
  const entries = latestCompletedEntries(catalogEntries);

  return {
    listIndexedDocuments() {
      return entries.map((entry) => ({ ...entry }));
    },
    async ask({ question, filters, topK = 3 }) {
      const queryNormalization = normalizeQuestionWithLexicon(question, intentLexicon);
      const lexiconMatches = collectLexiconMatches(
        queryNormalization.normalizedQuestion,
        intentLexicon,
      );
      const normalizedQuestion = queryNormalization.normalizedQuestion || question;
      const routingPlan = queryPlanner?.plan
        ? await queryPlanner.plan({
          question: normalizedQuestion,
          strictRouting: Boolean(plannerOptions.strictRouting),
        })
        : null;
      const plannerEnabled = Boolean(plannerOptions.enabled && routingPlan);
      const strictRouting = Boolean(plannerEnabled && routingPlan.strictRouting);
      const preferredDocumentTypes = plannerEnabled
        ? (routingPlan.preferredDocumentTypes ?? [])
          .map((item) => canonicalDocumentType(item))
          .filter(Boolean)
        : [];
      const preferredChunkKinds = plannerEnabled
        ? (routingPlan.preferredChunkKinds ?? [])
          .map((item) => normalize(item))
          .filter(Boolean)
        : [];
      const effectiveTopK = Number(routingPlan?.topK ?? topK);
      let queryPlanDebug = routingPlan
        ? {
          intentClass: routingPlan.intentClass ?? null,
          preferredDocumentTypes: preferredDocumentTypes,
          preferredChunkKinds: preferredChunkKinds,
          topK: effectiveTopK,
          strictRouting,
          plannerSource: routingPlan.plannerSource ?? "rule",
          plannerConfidence: Number(
            Number(routingPlan.plannerConfidence ?? 0).toFixed(3),
          ),
          llmFirst: Boolean(plannerOptions.llmFirst),
          queryNormalization:
            routingPlan.queryNormalization ?? queryNormalization,
          lexiconMatches: routingPlan.lexiconMatches ?? lexiconMatches,
        }
        : null;
      const filtered = entries.filter((entry) => matchFilters(entry, filters));
      const questionTokens = tokenize(normalizedQuestion).filter(
        (token) => !STOPWORDS.has(token),
      );
      const fallbackRouting = detectRoutingHints(questionTokens, normalizedQuestion);
      let routed = {
        ...fallbackRouting,
        routeSource: "rule-based",
        confidence: 1,
      };
      let routingWarning = null;
      if (intentRouter?.routeIntent) {
        try {
          const llmRoute = await intentRouter.routeIntent({
            question: normalizedQuestion,
          });
          const mergedBooleans = {
            tableIntent:
              Boolean(fallbackRouting.tableIntent) || Boolean(llmRoute.tableIntent),
            formulaIntent:
              Boolean(fallbackRouting.formulaIntent) || Boolean(llmRoute.formulaIntent),
            metadataIntent:
              Boolean(fallbackRouting.metadataIntent) ||
              Boolean(llmRoute.metadataIntent),
            riderIntent:
              Boolean(fallbackRouting.riderIntent) || Boolean(llmRoute.riderIntent),
            criticalIllnessListIntent:
              Boolean(fallbackRouting.criticalIllnessListIntent) ||
              Boolean(llmRoute.criticalIllnessListIntent),
            waitingPeriodIntent:
              Boolean(fallbackRouting.waitingPeriodIntent) ||
              Boolean(llmRoute.waitingPeriodIntent),
            sumAssuredIntent:
              Boolean(fallbackRouting.sumAssuredIntent) ||
              Boolean(llmRoute.sumAssuredIntent),
            premiumPaidYearIntent:
              Boolean(fallbackRouting.premiumPaidYearIntent) ||
              Boolean(llmRoute.premiumPaidYearIntent),
          };
          routed = {
            ...fallbackRouting,
            ...llmRoute,
            ...mergedBooleans,
            scopeHint: llmRoute.scopeHint ?? fallbackRouting.scopeHint,
            routeSource: llmRoute.routeSource ?? "llm",
          };
        } catch (error) {
          routingWarning = `Intent router fallback: ${
            error instanceof Error ? error.message : String(error)
          }`;
        }
      }
      const {
        tableIntent,
        formulaIntent,
        metadataIntent,
        riderIntent,
        criticalIllnessListIntent,
        waitingPeriodIntent,
        sumAssuredIntent,
        premiumPaidYearIntent,
        scopeHint,
      } = routed;
      const retrievalTopK = waitingPeriodIntent
        ? Math.max(effectiveTopK, 8)
        : premiumPaidYearIntent
          ? Math.max(effectiveTopK, 5)
          : effectiveTopK;
      const bonusComputationIntent =
        /\b(loyalty|performance|power[- ]?up|initial)\s+bonus\b/i.test(normalizedQuestion) &&
        /\bcalculate|compute|computed|formula|amount|value\b/i.test(normalizedQuestion);
      const planNameIntent = /\bbasic plan|plan name|name of (the )?plan|plan for\b/i.test(
        normalizedQuestion,
      );
      const skipped = [];
      const collectCandidates = ({ applyStrictRouting }) => {
        const candidates = [];

        for (const entry of filtered) {
          const normalizedDocType = canonicalDocumentType(entry.documentType ?? "");
          const entryAffinityBoost = computeEntryAffinityBoost(
            normalizedQuestion,
            entry,
          );
          const preferredDocType = preferredDocumentTypes.length === 0 ||
            preferredDocumentTypes.some(
              (docType) =>
                normalizedDocType === docType ||
                normalizedDocType.includes(docType) ||
                docType.includes(normalizedDocType),
            );
          if (applyStrictRouting && !preferredDocType) {
            continue;
          }

          const sourcePath = resolve(process.cwd(), entry.sourcePath);
          const extractedPath = entry.extractedTextPath
            ? resolve(process.cwd(), entry.extractedTextPath)
            : null;
          const extension = extname(sourcePath).toLowerCase();
          const contentPath = extractedPath || sourcePath;
          const contentExt = extname(contentPath).toLowerCase();
          if (!TEXT_EXTENSIONS.has(contentExt)) {
            skipped.push({
              sourcePath: entry.sourcePath,
              reason: `unsupported file type: ${extension || "unknown"} (no extracted text available)`,
            });
            continue;
          }

          if (!existsSync(contentPath)) {
            skipped.push({ sourcePath: entry.sourcePath, reason: "source file not found on disk" });
            continue;
          }
          const content = readFileSync(contentPath, "utf8");
          const scopeMatched = entryMatchesScope(entry, scopeHint);
          const chunks = [
            ...buildQueryChunks(content, {
              profileId: WEALTH_PRO_PROFILE_ID,
              linesPerChunk: 5,
            }),
            ...buildMetadataChunks(entry),
          ];
          for (const chunk of chunks) {
            const normalizedChunkKind = normalize(chunk.kind ?? "text");
            if (applyStrictRouting && preferredChunkKinds.length > 0) {
              if (!preferredChunkKinds.includes(normalizedChunkKind)) {
                continue;
              }
            }
            const score = scoreChunk(questionTokens, chunk.text, {
              kind: chunk.kind,
              tableIntent,
              formulaIntent,
              metadataIntent,
              bonusComputationIntent,
              planNameIntent,
              riderIntent,
              criticalIllnessListIntent,
              waitingPeriodIntent,
              sumAssuredIntent,
              premiumPaidYearIntent,
              documentType: entry.documentType ?? "",
              scopeMatched,
            });
            // Require a meaningful baseline score. Stopword filtering removes
            // common function words from questionTokens, but this threshold
            // provides an additional guard so weakly-matching chunks from
            // off-topic questions are never surfaced.
            if (score < 0.05) {
              continue;
            }
            let plannerBoost = 0;
            if (plannerEnabled && preferredDocType) {
              if (preferredChunkKinds.includes(normalizedChunkKind)) {
                plannerBoost += 0.55;
              } else if (preferredChunkKinds.length > 0) {
                plannerBoost -= 0.25;
              }
            }
            const effectiveScore = Math.max(
              0,
              Math.min(1, Number((score + plannerBoost + entryAffinityBoost).toFixed(6))),
            );
            candidates.push({
              score: effectiveScore,
              sourcePath: entry.sourcePath,
              productName: entry.productName,
              versionLabel: entry.versionLabel,
              jurisdiction: entry.jurisdiction,
              documentType: entry.documentType ?? "unknown",
              chunkIndex: chunk.chunkIndex,
              lineStart: chunk.lineStart,
              lineEnd: chunk.lineEnd,
              text: chunk.text,
              chunkKind: chunk.kind ?? "text",
            });
          }
        }
        return candidates;
      };

      let tierUsed = "strict";
      let candidates = collectCandidates({
        applyStrictRouting: strictRouting,
      });
      if (strictRouting && candidates.length === 0) {
        tierUsed = "relaxed_same_source";
        candidates = collectCandidates({
          applyStrictRouting: false,
        });
      }
      if (queryPlanDebug) {
        queryPlanDebug = {
          ...queryPlanDebug,
          tierUsed,
        };
      }

      // Pre-sort by keyword score and narrow to a pool before semantic reranking
      // to keep the Python call fast (avoids embedding hundreds of chunks).
      candidates.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return chunkKindRank(a.chunkKind) - chunkKindRank(b.chunkKind);
      });
      const rerankerPoolSize = retrievalTopK * 3;
      const candidatePool = candidates.slice(0, rerankerPoolSize);

      // Apply semantic reranking when available, then re-sort by blended score
      const reranked = semanticReranker
        ? semanticReranker.rerank(normalizedQuestion, candidatePool)
        : candidatePool;
      if (semanticReranker) {
        reranked.sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          return chunkKindRank(a.chunkKind) - chunkKindRank(b.chunkKind);
        });
      }

      const selected = reranked.slice(0, retrievalTopK);

      if (selected.length === 0) {
        const fallbackReview = reviewProvider.review({
          answer: "information not found",
          evidence: [],
          confidenceScore: 0,
        });
        return {
          answer: "information not found",
          confidenceScore: fallbackReview.confidenceScore,
          confidenceBand: fallbackReview.confidenceBand,
          reviewStatus: fallbackReview.status,
          reviewGaps: fallbackReview.gaps,
          citations: [],
          evidence: [],
          skipped,
          intentRouting: routed,
          queryPlan: queryPlanDebug,
          queryNormalization,
          lexiconMatches,
          routingWarning,
          answerMode: "stochastic",
          answerModeReason: "no_evidence",
        };
      }

      const confidenceScore = Number(
        (selected.reduce((sum, item) => sum + item.score, 0) / selected.length).toFixed(3),
      );

      const answer = conversationProvider.synthesizeAnswer({
        question: normalizedQuestion,
        evidence: selected,
      });
      const review = reviewProvider.review({
        answer,
        evidence: selected,
        confidenceScore,
      });
      const answerStrategy = resolveAnswerStrategy({
        question: normalizedQuestion,
        answer,
        confidenceScore: review.confidenceScore,
        intentRouting: routed,
        queryPlan: queryPlanDebug,
        evidence: selected,
      });
      const industryDefinitionAnswer =
        answerStrategy.sourcePreference === "industry"
          ? buildIndustryDefinitionAnswer({
            queryPlan: queryPlanDebug,
            lexiconMatches,
          })
          : null;

      return {
        answer,
        confidenceScore: review.confidenceScore,
        confidenceBand: review.confidenceBand,
        reviewStatus: review.status,
        reviewGaps: review.gaps,
        citations: selected.map((item) => ({
          sourcePath: item.sourcePath,
          productName: item.productName,
          versionLabel: item.versionLabel,
          jurisdiction: item.jurisdiction,
          documentType: item.documentType,
          chunkIndex: item.chunkIndex,
          chunkKind: item.chunkKind,
          lineRange: `${item.lineStart}-${item.lineEnd}`,
          score: Number(item.score.toFixed(3)),
        })),
        evidence: selected.map((item) => ({
          sourcePath: item.sourcePath,
          lineStart: item.lineStart,
          lineEnd: item.lineEnd,
          chunkKind: item.chunkKind,
          score: Number(item.score.toFixed(3)),
          text: item.text,
        })),
        skipped,
        intentRouting: routed,
        queryPlan: queryPlanDebug,
        queryNormalization,
        lexiconMatches,
        routingWarning,
        answerMode: answerStrategy.mode,
        answerModeReason: answerStrategy.reason,
        answerSourcePreference: answerStrategy.sourcePreference,
        industryDefinitionAnswer,
      };
    },
  };
}
