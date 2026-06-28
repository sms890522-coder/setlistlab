"use client";

import { getCurrentSession } from "@/lib/auth";
import type { TrackMixState } from "@/hooks/useMultitrackPlayer";

export type RecordingMixSetting = TrackMixState & {
  id?: string;
  sessionId?: string;
  trackKey: string;
  createdAt?: string;
  updatedAt?: string;
};

type GetMixSettingsResponse = {
  settings: RecordingMixSetting[];
};

type UpsertMixSettingResponse = {
  setting: RecordingMixSetting;
};

export async function getRecordingMixSettings(sessionId: string) {
  const session = await getCurrentSession();
  const token = session?.access_token;
  if (!token) throw new Error("로그인이 필요합니다.");

  const response = await fetch(`/api/recordings/mix-settings?sessionId=${encodeURIComponent(sessionId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = (await response.json().catch(() => ({}))) as Partial<GetMixSettingsResponse> & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "믹서 설정을 불러오지 못했습니다.");
  }

  return payload.settings ?? [];
}

export async function upsertRecordingMixSetting(sessionId: string, mix: RecordingMixSetting) {
  const session = await getCurrentSession();
  const token = session?.access_token;
  if (!token) throw new Error("로그인이 필요합니다.");

  const response = await fetch("/api/recordings/mix-settings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sessionId, mix }),
  });

  const payload = (await response.json().catch(() => ({}))) as Partial<UpsertMixSettingResponse> & { error?: string };
  if (!response.ok || !payload.setting) {
    throw new Error(payload.error || "믹서 설정을 저장하지 못했습니다.");
  }

  return payload.setting;
}
