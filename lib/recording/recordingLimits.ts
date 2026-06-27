export const DEFAULT_RECORDING_LIMITS = {
  monthlySessionsPerTeam: 3,
  tracksPerSession: 12,
  versionsPerUserPart: 2,
  maxTrackSizeBytes: 30 * 1024 * 1024,
  maxTrackDurationSeconds: 10 * 60,
  retentionDays: 60,
  pendingUploadCleanupHours: 24,
  failedCleanupDays: 7,
} as const;

export type RecordingLimitPlan = "free" | "beta" | "pro" | "custom";

export type RecordingLimitConfig = {
  plan: RecordingLimitPlan | string;
  monthlySessionsLimit: number;
  tracksPerSessionLimit: number;
  versionsPerUserPartLimit: number;
  maxTrackSizeBytes: number;
  maxTrackDurationSeconds: number;
  retentionDays: number;
  isUnlimited: boolean;
};

export type LabFeatureProfile = {
  labEnabled?: boolean | null;
  lab_enabled?: boolean | null;
};

export function getDefaultRecordingLimitConfig(): RecordingLimitConfig {
  return {
    plan: "free",
    monthlySessionsLimit: DEFAULT_RECORDING_LIMITS.monthlySessionsPerTeam,
    tracksPerSessionLimit: DEFAULT_RECORDING_LIMITS.tracksPerSession,
    versionsPerUserPartLimit: DEFAULT_RECORDING_LIMITS.versionsPerUserPart,
    maxTrackSizeBytes: DEFAULT_RECORDING_LIMITS.maxTrackSizeBytes,
    maxTrackDurationSeconds: DEFAULT_RECORDING_LIMITS.maxTrackDurationSeconds,
    retentionDays: DEFAULT_RECORDING_LIMITS.retentionDays,
    isUnlimited: false,
  };
}

export function shouldBypassRecordingLimits(profile: LabFeatureProfile | null | undefined): boolean {
  // 실험실 사용자는 테스트 목적으로 녹음실 quota 제한을 우회한다.
  // 단, 팀 접근 권한/approved membership/R2 presigned URL 권한 검사는 서버에서 별도로 반드시 검증해야 한다.
  return Boolean(profile?.labEnabled ?? profile?.lab_enabled ?? false);
}

export function getCurrentRecordingYearMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthRange(yearMonth = getCurrentRecordingYearMonth()) {
  const [yearValue, monthValue] = yearMonth.split("-").map(Number);
  const start = new Date(Date.UTC(yearValue, monthValue - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(yearValue, monthValue, 1, 0, 0, 0));
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export function formatRecordingLimitBytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return `${Math.round(mb)}MB`;
}
