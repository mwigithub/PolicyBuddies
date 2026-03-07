import {
  WEALTH_PRO_PROFILE_ID,
  chunkCriticalIllnessList,
  chunkFormulas,
  chunkTables,
  chunkTextByLines,
} from "./profiles/wealthProProfile.js";

const PROFILE_REGISTRY = new Map([
  [
    WEALTH_PRO_PROFILE_ID,
    {
      text: chunkTextByLines,
      table: chunkTables,
      formula: chunkFormulas,
      criticalIllness: chunkCriticalIllnessList,
    },
  ],
]);

export function buildQueryChunks(
  content,
  { profileId = WEALTH_PRO_PROFILE_ID, linesPerChunk = 5 } = {},
) {
  const profile = PROFILE_REGISTRY.get(profileId) ?? PROFILE_REGISTRY.get(WEALTH_PRO_PROFILE_ID);
  const textChunks = profile.text(content, linesPerChunk);
  const tableChunks = profile.table(content);
  const formulaChunks = profile.formula(content);
  const criticalIllnessChunks = profile.criticalIllness(content);
  return [
    ...textChunks,
    ...tableChunks,
    ...formulaChunks,
    ...criticalIllnessChunks,
  ];
}

export function listChunkingProfiles() {
  return [...PROFILE_REGISTRY.keys()];
}

