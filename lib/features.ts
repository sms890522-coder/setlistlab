import type { Profile } from "@/lib/db/profiles";

export type FeatureStatus = "admin" | "lab" | "public" | "disabled";
type FeatureProfile = Pick<Profile, "labEnabled" | "isAdmin">;

export const FEATURES = {
  teamGuideTrack: {
    key: "teamGuideTrack",
    label: "팀 가이드 트랙",
    status: "lab",
  },
  teamRecordingStudio: {
    key: "teamRecordingStudio",
    label: "팀 녹음실",
    status: "lab",
  },
  profileCharacterBuilder: {
    key: "profileCharacterBuilder",
    label: "내 캐릭터 선택",
    status: "admin",
  },
} as const satisfies Record<string, { key: string; label: string; status: FeatureStatus }>;

export type FeatureKey = keyof typeof FEATURES;

export function isFeaturePublic(featureKey: FeatureKey) {
  return getFeatureStatus(featureKey) === "public";
}

export function canUseLabFeature(profile: Partial<Pick<FeatureProfile, "labEnabled">> | null | undefined, featureKey: FeatureKey) {
  return getFeatureStatus(featureKey) === "lab" && Boolean(profile?.labEnabled);
}

export function canUseFeature(profile: Partial<FeatureProfile> | null | undefined, featureKey: FeatureKey) {
  const status = getFeatureStatus(featureKey);
  if (status === "disabled") return false;
  if (status === "public") return true;
  if (status === "admin") return Boolean(profile?.isAdmin);
  return canUseLabFeature(profile, featureKey);
}

function getFeatureStatus(featureKey: FeatureKey): FeatureStatus {
  return FEATURES[featureKey].status as FeatureStatus;
}
