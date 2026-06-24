import type { Profile } from "@/lib/db/profiles";

export type FeatureStatus = "lab" | "public" | "disabled";

export const FEATURES = {
  teamGuideTrack: {
    key: "teamGuideTrack",
    label: "팀 가이드 트랙",
    status: "lab",
  },
} as const satisfies Record<string, { key: string; label: string; status: FeatureStatus }>;

export type FeatureKey = keyof typeof FEATURES;

export function isFeaturePublic(featureKey: FeatureKey) {
  return getFeatureStatus(featureKey) === "public";
}

export function canUseLabFeature(profile: Pick<Profile, "labEnabled"> | null | undefined, featureKey: FeatureKey) {
  return getFeatureStatus(featureKey) === "lab" && Boolean(profile?.labEnabled);
}

export function canUseFeature(profile: Pick<Profile, "labEnabled"> | null | undefined, featureKey: FeatureKey) {
  const status = getFeatureStatus(featureKey);
  if (status === "disabled") return false;
  if (status === "public") return true;
  return canUseLabFeature(profile, featureKey);
}

function getFeatureStatus(featureKey: FeatureKey): FeatureStatus {
  return FEATURES[featureKey].status as FeatureStatus;
}
