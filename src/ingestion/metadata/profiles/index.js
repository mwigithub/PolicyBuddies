import { createBaseMetadataProfile } from "./baseProfile.js";
import { createWealthProMetadataProfile } from "./wealthProProfile.js";

function createProfileRegistry() {
  const baseProfile = createBaseMetadataProfile();
  const wealthProProfile = createWealthProMetadataProfile();
  return [wealthProProfile, baseProfile];
}

const PROFILE_REGISTRY = createProfileRegistry();

export function resolveMetadataProfile({ metadata, contentText }) {
  for (const profile of PROFILE_REGISTRY) {
    if (profile.matches({ metadata, contentText })) {
      return profile;
    }
  }
  return PROFILE_REGISTRY[PROFILE_REGISTRY.length - 1];
}

export function listMetadataProfiles() {
  return PROFILE_REGISTRY.map((profile) => ({
    id: profile.id,
    version: profile.version ?? "v1",
    parentId: profile.parentId ?? null,
  }));
}

