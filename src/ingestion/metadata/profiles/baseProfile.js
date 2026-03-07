export const BASE_METADATA_PROFILE_ID = "life-generic-profile";

export function createBaseMetadataProfile() {
  return {
    id: BASE_METADATA_PROFILE_ID,
    matches() {
      return true;
    },
    getBonusDefinitions(definitions = []) {
      return Array.isArray(definitions) ? definitions : [];
    },
    getIndustryTermDefinitions(definitions = []) {
      return Array.isArray(definitions) ? definitions : [];
    },
    postProcess({
      product,
      benefitAttributes,
      riderAttributes,
      mappingWarnings,
    }) {
      return {
        product,
        benefitAttributes,
        riderAttributes,
        mappingWarnings: Array.isArray(mappingWarnings) ? mappingWarnings : [],
      };
    },
  };
}

