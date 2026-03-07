import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const METADATA_RUNTIME_CONFIG_PATH = resolve(
  process.cwd(),
  "metadata/runtime/metadata-runtime.json",
);

export const DEFAULT_METADATA_RUNTIME_CONFIG = {
  metadataStandardVersion: "li-metadata-v1",
  metadataParserVersion: "li-metadata-parser-v2",
  schemaVersion: "1.0.0",
  defaults: {
    unknownValue: "to be defined",
    lineOfBusiness: "life-insurance",
    language: "en",
    sourceSystem: "manual-ingestion",
    dataClass: "internal",
    piiContains: "to be defined",
    regulatoryRegime: "to be defined",
  },
  validation: {
    maxRate: 0.5,
  },
  profiles: {
    "investment-linked": { profileId: "life-investment-linked", profileVersion: "v1" },
    "term-life": { profileId: "life-term", profileVersion: "v1" },
    "whole-life": { profileId: "life-whole-life", profileVersion: "v1" },
    generic: { profileId: "life-generic", profileVersion: "v1" },
  },
  bonusDefinitions: [
    { bonusType: "initial bonus", headingPattern: "^initial bonus$" },
    {
      bonusType: "performance investment bonus",
      headingPattern: "^performance investment bonus$",
    },
    { bonusType: "loyalty bonus", headingPattern: "^loyalty bonus$" },
    { bonusType: "power-up bonus", headingPattern: "^power-?up bonus$" },
  ],
  industryTermDefinitions: [
    { canonicalTerm: "basic_plan", label: "Basic Plan", patterns: ["basic plan"] },
    { canonicalTerm: "sum_assured", label: "Sum Assured", patterns: ["sum assured", "basic sum assured"] },
    { canonicalTerm: "death_benefit", label: "Death Benefit", patterns: ["death benefit"] },
    { canonicalTerm: "policy_value", label: "Policy Value", patterns: ["policy value", "non-guaranteed policy value"] },
    { canonicalTerm: "surrender_value", label: "Surrender Value", patterns: ["surrender value", "non-guaranteed surrender value"] },
    { canonicalTerm: "premium_paid_to_date", label: "Premiums Paid To-Date", patterns: ["total premiums paid to-date", "premium paid to-date", "premiums paid to-date"] },
    { canonicalTerm: "account_value", label: "Account Value", patterns: ["account value"] },
    { canonicalTerm: "initial_bonus", label: "Initial Bonus", patterns: ["initial bonus"] },
    { canonicalTerm: "performance_investment_bonus", label: "Performance Investment Bonus", patterns: ["performance investment bonus"] },
    { canonicalTerm: "loyalty_bonus", label: "Loyalty Bonus", patterns: ["loyalty bonus"] },
    { canonicalTerm: "power_up_bonus", label: "Power-up Bonus", patterns: ["power-up bonus", "power up bonus"] },
  ],
};

function ensureConfigDir() {
  mkdirSync(dirname(METADATA_RUNTIME_CONFIG_PATH), { recursive: true });
}

export function saveMetadataRuntimeConfig(config) {
  ensureConfigDir();
  writeFileSync(
    METADATA_RUNTIME_CONFIG_PATH,
    `${JSON.stringify(config, null, 2)}\n`,
    "utf8",
  );
}

export function loadMetadataRuntimeConfig() {
  ensureConfigDir();
  try {
    const parsed = JSON.parse(readFileSync(METADATA_RUNTIME_CONFIG_PATH, "utf8"));
    return {
      ...DEFAULT_METADATA_RUNTIME_CONFIG,
      ...parsed,
      defaults: {
        ...DEFAULT_METADATA_RUNTIME_CONFIG.defaults,
        ...(parsed.defaults ?? {}),
      },
      validation: {
        ...DEFAULT_METADATA_RUNTIME_CONFIG.validation,
        ...(parsed.validation ?? {}),
      },
      profiles: {
        ...DEFAULT_METADATA_RUNTIME_CONFIG.profiles,
        ...(parsed.profiles ?? {}),
      },
      bonusDefinitions:
        Array.isArray(parsed.bonusDefinitions) &&
        parsed.bonusDefinitions.length > 0
          ? parsed.bonusDefinitions
          : DEFAULT_METADATA_RUNTIME_CONFIG.bonusDefinitions,
      industryTermDefinitions:
        Array.isArray(parsed.industryTermDefinitions) &&
        parsed.industryTermDefinitions.length > 0
          ? parsed.industryTermDefinitions
          : DEFAULT_METADATA_RUNTIME_CONFIG.industryTermDefinitions,
    };
  } catch {
    saveMetadataRuntimeConfig(DEFAULT_METADATA_RUNTIME_CONFIG);
    return { ...DEFAULT_METADATA_RUNTIME_CONFIG };
  }
}
