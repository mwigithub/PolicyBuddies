import { BASE_METADATA_PROFILE_ID } from "./baseProfile.js";

export const WEALTH_PRO_METADATA_PROFILE_ID = "wealth-pro-ii-metadata-profile";

function uniqueBonusDefinitions(definitions = []) {
  const map = new Map();
  for (const definition of definitions) {
    if (!definition?.bonusType || !definition?.headingPattern) {
      continue;
    }
    map.set(definition.bonusType.toLowerCase(), definition);
  }
  return [...map.values()];
}

function uniqueIndustryTermDefinitions(definitions = []) {
  const map = new Map();
  for (const definition of definitions) {
    if (!definition?.canonicalTerm) {
      continue;
    }
    map.set(definition.canonicalTerm.toLowerCase(), definition);
  }
  return [...map.values()];
}

export function createWealthProMetadataProfile() {
  return {
    id: WEALTH_PRO_METADATA_PROFILE_ID,
    version: "v1",
    parentId: BASE_METADATA_PROFILE_ID,
    matches({ metadata, contentText }) {
      const productName = String(metadata?.productName ?? "").toLowerCase();
      if (productName.includes("wealth pro")) {
        return true;
      }
      const content = String(contentText ?? "").toLowerCase();
      return content.includes("wealth pro");
    },
    getBonusDefinitions(definitions = []) {
      const wealthProBonusDefinitions = [
        { bonusType: "initial bonus", headingPattern: "^initial bonus$" },
        {
          bonusType: "performance investment bonus",
          headingPattern: "^performance investment bonus$",
        },
        { bonusType: "loyalty bonus", headingPattern: "^loyalty bonus$" },
        { bonusType: "power-up bonus", headingPattern: "^power-?up bonus$" },
      ];
      return uniqueBonusDefinitions([
        ...(Array.isArray(definitions) ? definitions : []),
        ...wealthProBonusDefinitions,
      ]);
    },
    getIndustryTermDefinitions(definitions = []) {
      const wealthProIndustryTerms = [
        {
          canonicalTerm: "enhanced_payer_benefit_rider",
          label: "Enhanced Payer Benefit Rider",
          patterns: ["enhanced payer benefit rider"],
        },
        {
          canonicalTerm: "waiting_period",
          label: "Waiting Period",
          patterns: ["waiting period", "within 90 days"],
        },
        {
          canonicalTerm: "premium_shortfall_charge",
          label: "Premium Shortfall Charge",
          patterns: ["premium shortfall charge"],
        },
        {
          canonicalTerm: "covered_critical_illnesses",
          label: "Covered Critical Illnesses",
          patterns: ["40 covered critical illnesses", "table 1"],
        },
      ];
      return uniqueIndustryTermDefinitions([
        ...(Array.isArray(definitions) ? definitions : []),
        ...wealthProIndustryTerms,
      ]);
    },
    postProcess({
      product,
      benefitAttributes,
      riderAttributes,
      mappingWarnings,
    }) {
      const nextProduct = {
        ...product,
        productLevel: {
          ...(product?.productLevel ?? {}),
        },
      };
      if (
        !nextProduct.productLevel.planName &&
        typeof nextProduct.productName === "string" &&
        nextProduct.productName.trim().length > 0
      ) {
        nextProduct.productLevel.planName = nextProduct.productName;
      }

      return {
        product: nextProduct,
        benefitAttributes,
        riderAttributes,
        mappingWarnings: Array.isArray(mappingWarnings) ? mappingWarnings : [],
      };
    },
  };
}

