import { randomUUID } from "crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  DEFAULT_TRACK_EFFECTS,
  normalizeTrackEffects,
  type TrackEffectSettings,
} from "@/lib/audio/trackEffects";
import {
  RECORDING_PRESIGNED_EXPIRES_IN_SECONDS,
  buildRecordingObjectKey,
  createPresignedReadUrl,
  createPresignedUploadUrl,
  getR2ObjectMetadata,
  getRecordingBucket,
  normalizeRecordingMimeType,
  safeDeleteR2Object,
} from "@/lib/storage/r2";
import {
  formatRecordingLimitBytes,
  getCurrentRecordingYearMonth,
  getDefaultRecordingLimitConfig,
  getMonthRange,
  shouldBypassRecordingLimits,
  type RecordingLimitConfig,
} from "@/lib/recording/recordingLimits";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type RecordingSessionRow = {
  id: string;
  team_id: string | null;
  setlist_id: string;
  song_id: string;
  guide_track_id: string;
  title: string;
  status: "open" | "closed" | "archived";
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type GuideTrackRow = {
  id: string;
  team_id: string | null;
  setlist_id: string;
  song_id: string;
  created_by: string | null;
  guide_track_data: unknown;
};

type SetlistRow = {
  id: string;
  user_id: string;
  team_id: string | null;
};

type RecordingTrackRow = {
  id: string;
  session_id: string;
  team_id: string | null;
  guide_track_id: string;
  user_id: string | null;
  part: string | null;
  title: string;
  storage_provider: string;
  bucket: string | null;
  object_key: string | null;
  mime_type: string | null;
  duration_seconds: number | null;
  size_bytes: number | null;
  input_type: string;
  device_label: string | null;
  latency_offset_ms: number | null;
  recording_offset_ms: number | null;
  guide_track_snapshot: unknown;
  notes: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileLabRow = {
  lab_enabled: boolean | null;
};

type TeamRecordingLimitRow = {
  plan: string;
  monthly_sessions_limit: number | null;
  tracks_per_session_limit: number | null;
  versions_per_user_part_limit: number | null;
  max_track_size_bytes: number | string | null;
  max_track_duration_seconds: number | null;
  retention_days: number | null;
  is_unlimited: boolean | null;
};

type TeamRecordingUsageMonthlyRow = {
  team_id: string;
  year_month: string;
  sessions_created_count: number | null;
  tracks_uploaded_count: number | null;
  storage_bytes_used: number | string | null;
};

type RecordingMixSettingRow = {
  id: string;
  session_id: string;
  track_key: string;
  volume: number | string | null;
  pan: number | string | null;
  muted: boolean | null;
  solo: boolean | null;
  latency_offset_ms: number | null;
  gain_db: number | string | null;
  eq_low_gain_db: number | string | null;
  eq_mid_gain_db: number | string | null;
  eq_high_gain_db: number | string | null;
  compressor_enabled: boolean | null;
  compressor_preset: string | null;
  reverb_type: string | null;
  reverb_amount: number | string | null;
  created_at: string;
  updated_at: string;
};

export type RecordingMixSettingInput = {
  trackKey: string;
  volume?: number;
  pan?: number;
  muted?: boolean;
  solo?: boolean;
  latencyOffsetMs?: number;
  effects?: Partial<TrackEffectSettings>;
};

export type RecordingMixSetting = {
  id: string;
  sessionId: string;
  trackKey: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  latencyOffsetMs: number;
  effects: TrackEffectSettings;
  createdAt: string;
  updatedAt: string;
};

type SanitizedRecordingMixSetting = {
  trackKey: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  latencyOffsetMs: number;
  effects: TrackEffectSettings;
};

export type RecordingAccessContext = {
  supabase: SupabaseClient;
  user: User;
};

export async function getRecordingAccessContext(request: Request): Promise<RecordingAccessContext> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new RecordingApiError("로그인이 필요합니다.", 401);

  const supabase = getSupabaseAdminClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) throw new RecordingApiError("로그인이 필요합니다.", 401);
  return { supabase, user };
}

export async function createRecordingSessionWithLimits(input: {
  request: Request;
  teamId?: string | null;
  setlistId: string;
  songId: string;
  guideTrackId: string;
  title: string;
}) {
  const { supabase, user } = await getRecordingAccessContext(input.request);
  const guideTrack = await getGuideTrackOrThrow(supabase, input.guideTrackId);
  const setlist = await getSetlistOrThrow(supabase, input.setlistId);

  if (guideTrack.setlist_id !== input.setlistId || guideTrack.song_id !== input.songId) {
    throw new RecordingApiError("가이드 트랙 정보가 콘티와 일치하지 않습니다.", 400);
  }

  if ((guideTrack.team_id ?? null) !== (input.teamId ?? null) || (setlist.team_id ?? null) !== (input.teamId ?? null)) {
    throw new RecordingApiError("팀 녹음실 정보가 일치하지 않습니다.", 400);
  }

  await assertCanManageRecordingSession(supabase, user.id, guideTrack, setlist);

  if (input.teamId) {
    const quota = await getRecordingQuotaContext(supabase, user.id, input.teamId);
    if (!quota.bypassLimits) {
      const currentCount = await getMonthlySessionCountForLimit(supabase, input.teamId);
      if (currentCount >= quota.limits.monthlySessionsLimit) {
        throw new RecordingApiError(
          `이번 달 녹음실 생성 가능 횟수를 모두 사용했습니다. 이번 달 녹음실: ${currentCount} / ${quota.limits.monthlySessionsLimit}개 사용`,
          403,
        );
      }
    }
  }

  const { data, error } = await supabase
    .from("team_recording_sessions")
    .insert({
      team_id: input.teamId || null,
      setlist_id: input.setlistId,
      song_id: input.songId,
      guide_track_id: input.guideTrackId,
      title: input.title.trim() || "팀 녹음실",
      status: "open",
      created_by: user.id,
    })
    .select("*")
    .single<RecordingSessionRow>();

  if (error || !data) throw new RecordingApiError(error?.message || "녹음 세션을 만들지 못했습니다.", 500);

  if (input.teamId) {
    await incrementMonthlyRecordingUsage(supabase, input.teamId, { sessionsDelta: 1 }).catch(() => undefined);
  }

  return { session: rowToApiSession(data) };
}

export async function createPresignedRecordingUpload(input: {
  request: Request;
  sessionId: string;
  guideTrackId: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number;
  part?: string;
  title?: string;
  notes?: string;
  inputType?: string;
  deviceLabel?: string;
  recordingOffsetMs?: number;
  latencyOffsetMs?: number;
}) {
  const { supabase, user } = await getRecordingAccessContext(input.request);
  const mimeType = normalizeRecordingMimeType(input.mimeType);
  const sizeBytes = Number(input.sizeBytes);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) throw new RecordingApiError("녹음 파일 크기를 확인할 수 없습니다.", 400);

  const session = await getSessionOrThrow(supabase, input.sessionId);
  if (session.status !== "open") throw new RecordingApiError("닫힌 녹음 세션에는 업로드할 수 없습니다.", 403);
  if (session.guide_track_id !== input.guideTrackId) throw new RecordingApiError("가이드 트랙 정보가 일치하지 않습니다.", 400);

  const guideTrack = await getGuideTrackOrThrow(supabase, input.guideTrackId);
  const setlist = await getSetlistOrThrow(supabase, session.setlist_id);
  await assertCanAccessRecording(supabase, user.id, session, setlist);

  const durationSeconds = normalizeDuration(input.durationSeconds);
  const quota = session.team_id ? await getRecordingQuotaContext(supabase, user.id, session.team_id) : null;
  if (quota && !quota.bypassLimits) {
    if (sizeBytes > quota.limits.maxTrackSizeBytes) {
      throw new RecordingApiError(
        `녹음 파일이 너무 큽니다. 최대 ${formatRecordingLimitBytes(quota.limits.maxTrackSizeBytes)}까지 업로드할 수 있습니다.`,
        413,
      );
    }

    if (durationSeconds !== null && durationSeconds > quota.limits.maxTrackDurationSeconds) {
      throw new RecordingApiError(
        `녹음 시간이 너무 깁니다. 최대 ${Math.round(quota.limits.maxTrackDurationSeconds / 60)}분까지 업로드할 수 있습니다.`,
        413,
      );
    }

    const activeTrackCount = await countActiveTracksInSession(supabase, session.id);
    if (activeTrackCount >= quota.limits.tracksPerSessionLimit) {
      throw new RecordingApiError("이 곡의 녹음 트랙 수가 제한에 도달했습니다. 필요 없는 트랙을 삭제한 뒤 다시 시도해 주세요.", 403);
    }
  }

  const trackId = randomUUID();
  const objectKey = buildRecordingObjectKey({
    teamId: session.team_id,
    sessionId: session.id,
    setlistId: session.setlist_id,
    userId: user.id,
    trackId,
    mimeType,
  });

  const title = input.title?.trim().slice(0, 80) || `${input.part?.trim() || "내 파트"} 녹음`;
  const { error } = await supabase.from("team_recording_tracks").insert({
    id: trackId,
    session_id: session.id,
    team_id: session.team_id,
    guide_track_id: guideTrack.id,
    user_id: user.id,
    part: input.part?.trim().slice(0, 40) || null,
    title,
    storage_provider: "r2",
    bucket: getRecordingBucket(),
    object_key: objectKey,
    mime_type: mimeType,
    duration_seconds: durationSeconds,
    size_bytes: sizeBytes,
    input_type: normalizeRecordingInputType(input.inputType),
    device_label: input.deviceLabel?.trim().slice(0, 160) || null,
    latency_offset_ms: normalizeInteger(input.latencyOffsetMs, 0),
    recording_offset_ms: normalizeInteger(input.recordingOffsetMs, 0),
    guide_track_snapshot: guideTrack.guide_track_data ?? {},
    notes: input.notes?.trim().slice(0, 1000) || null,
    status: "uploading",
  });

  if (error) throw new RecordingApiError(error.message || "녹음 트랙을 준비하지 못했습니다.", 500);

  const uploadUrl = await createPresignedUploadUrl({ objectKey, mimeType });
  return {
    trackId,
    uploadUrl,
    objectKey,
    expiresIn: RECORDING_PRESIGNED_EXPIRES_IN_SECONDS,
  };
}

export async function completeRecordingUpload(input: {
  request: Request;
  trackId: string;
  objectKey: string;
  sizeBytes?: number;
  durationSeconds?: number;
  mimeType?: string;
}) {
  const { supabase, user } = await getRecordingAccessContext(input.request);
  const track = await getTrackOrThrow(supabase, input.trackId);
  if (track.user_id !== user.id) throw new RecordingApiError("이 녹음을 완료할 권한이 없습니다.", 403);
  if (!track.object_key || track.object_key !== input.objectKey) {
    throw new RecordingApiError("녹음 파일 경로가 일치하지 않습니다.", 400);
  }

  await getR2ObjectMetadata(track.object_key).catch(() => {
    throw new RecordingApiError("R2에서 업로드된 파일을 확인하지 못했습니다.", 400);
  });

  const { data, error } = await supabase
    .from("team_recording_tracks")
    .update({
      status: "active",
      size_bytes: Number.isFinite(Number(input.sizeBytes)) ? Number(input.sizeBytes) : track.size_bytes,
      duration_seconds: normalizeDuration(input.durationSeconds) ?? track.duration_seconds,
      mime_type: input.mimeType ? normalizeRecordingMimeType(input.mimeType) : track.mime_type,
      storage_provider: "r2",
      bucket: getRecordingBucket(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", track.id)
    .select("*")
    .single<RecordingTrackRow>();

  if (error || !data) throw new RecordingApiError(error?.message || "녹음 업로드를 완료하지 못했습니다.", 500);

  if (data.team_id) {
    await incrementMonthlyRecordingUsage(supabase, data.team_id, {
      tracksDelta: 1,
      storageBytesDelta: Number(data.size_bytes ?? 0),
    }).catch(() => undefined);

    const quota = await getRecordingQuotaContext(supabase, user.id, data.team_id);
    if (!quota.bypassLimits) {
      await enforceVersionsPerUserPartLimit(supabase, data, quota.limits.versionsPerUserPartLimit).catch(() => undefined);
    }
  }

  await createRecordingUploadedNotification(supabase, data).catch(() => undefined);

  return { track: rowToApiTrack(data) };
}

export async function createRecordingReadUrl(input: { request: Request; trackId: string }) {
  const { supabase, user } = await getRecordingAccessContext(input.request);
  const track = await getTrackOrThrow(supabase, input.trackId);
  if (track.status !== "active") throw new RecordingApiError("재생할 수 없는 녹음입니다.", 400);
  if (!track.object_key) throw new RecordingApiError("녹음 파일 경로가 없습니다.", 400);

  const session = await getSessionOrThrow(supabase, track.session_id);
  const setlist = await getSetlistOrThrow(supabase, session.setlist_id);
  await assertCanAccessRecording(supabase, user.id, session, setlist);

  const readUrl = await createPresignedReadUrl({ objectKey: track.object_key });
  return {
    readUrl,
    expiresIn: RECORDING_PRESIGNED_EXPIRES_IN_SECONDS,
  };
}

export async function markRecordingTrackDeleted(input: { request: Request; trackId: string }) {
  const { supabase, user } = await getRecordingAccessContext(input.request);
  const track = await getTrackOrThrow(supabase, input.trackId);
  if (track.status === "deleted") return { track: rowToApiTrack(track) };

  const session = await getSessionOrThrow(supabase, track.session_id);
  const setlist = await getSetlistOrThrow(supabase, session.setlist_id);
  await assertCanModifyRecordingTrack(supabase, user.id, track, session, setlist);

  const { data, error } = await supabase
    .from("team_recording_tracks")
    .update({
      status: "deleted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", track.id)
    .select("*")
    .single<RecordingTrackRow>();

  if (error || !data) throw new RecordingApiError(error?.message || "녹음을 삭제하지 못했습니다.", 500);

  if (track.object_key) {
    const deleteResult = await safeDeleteR2Object(track.object_key);
    await supabase
      .from("team_recording_tracks")
      .update({
        object_key: deleteResult.ok ? null : track.object_key,
        error_message: deleteResult.ok ? null : `r2_delete_failed: ${deleteResult.error ?? "unknown"}`.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", track.id);
  }

  return { track: rowToApiTrack(data) };
}

export async function updateRecordingTrackLatencyOffset(input: {
  request: Request;
  trackId: string;
  latencyOffsetMs: number;
}) {
  const { supabase, user } = await getRecordingAccessContext(input.request);
  const track = await getTrackOrThrow(supabase, input.trackId);
  if (track.status === "deleted") throw new RecordingApiError("삭제된 녹음은 수정할 수 없습니다.", 400);

  const session = await getSessionOrThrow(supabase, track.session_id);
  const setlist = await getSetlistOrThrow(supabase, session.setlist_id);
  await assertCanModifyRecordingTrack(supabase, user.id, track, session, setlist);

  const { data, error } = await supabase
    .from("team_recording_tracks")
    .update({
      latency_offset_ms: Math.max(-2000, Math.min(2000, normalizeInteger(input.latencyOffsetMs, 0))),
      updated_at: new Date().toISOString(),
    })
    .eq("id", track.id)
    .select("*")
    .single<RecordingTrackRow>();

  if (error || !data) throw new RecordingApiError(error?.message || "트랙 싱크를 저장하지 못했습니다.", 500);
  return { track: rowToApiTrack(data) };
}

export async function getRecordingMixSettings(input: { request: Request; sessionId: string }) {
  const { supabase, user } = await getRecordingAccessContext(input.request);
  const session = await getSessionOrThrow(supabase, input.sessionId);
  const setlist = await getSetlistOrThrow(supabase, session.setlist_id);
  await assertCanAccessRecording(supabase, user.id, session, setlist);

  const { data, error } = await supabase
    .from("team_recording_mix_settings")
    .select("*")
    .eq("session_id", session.id)
    .returns<RecordingMixSettingRow[]>();

  if (error) throw new RecordingApiError(error.message || "믹서 설정을 불러오지 못했습니다.", 500);
  return { settings: (data ?? []).map(rowToApiMixSetting) };
}

export async function upsertRecordingMixSetting(input: {
  request: Request;
  sessionId: string;
  mix: RecordingMixSettingInput;
}) {
  const { supabase, user } = await getRecordingAccessContext(input.request);
  const session = await getSessionOrThrow(supabase, input.sessionId);
  const setlist = await getSetlistOrThrow(supabase, session.setlist_id);
  await assertCanAccessRecording(supabase, user.id, session, setlist);

  const mix = sanitizeRecordingMixSetting(input.mix);
  await assertMixTrackKeyBelongsToSession(supabase, session.id, mix.trackKey);

  const effects = mix.effects;
  const payload = {
    session_id: session.id,
    track_key: mix.trackKey,
    volume: mix.volume,
    pan: mix.pan,
    muted: mix.muted,
    solo: mix.solo,
    latency_offset_ms: mix.latencyOffsetMs,
    gain_db: effects.gainDb,
    eq_low_gain_db: effects.eq.lowGainDb,
    eq_mid_gain_db: effects.eq.midGainDb,
    eq_high_gain_db: effects.eq.highGainDb,
    compressor_enabled: effects.compressor.enabled,
    compressor_preset: effects.compressor.preset,
    reverb_type: effects.reverb.type,
    reverb_amount: effects.reverb.amount,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("team_recording_mix_settings")
    .upsert(payload, { onConflict: "session_id,track_key" })
    .select("*")
    .single<RecordingMixSettingRow>();

  if (error || !data) throw new RecordingApiError(error?.message || "믹서 설정을 저장하지 못했습니다.", 500);
  return { setting: rowToApiMixSetting(data) };
}

async function getSessionOrThrow(supabase: SupabaseClient, sessionId: string) {
  const { data, error } = await supabase
    .from("team_recording_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle<RecordingSessionRow>();

  if (error) throw new RecordingApiError(error.message || "녹음 세션을 확인하지 못했습니다.", 500);
  if (!data) throw new RecordingApiError("녹음 세션을 찾을 수 없습니다.", 404);
  return data;
}

async function getGuideTrackOrThrow(supabase: SupabaseClient, guideTrackId: string) {
  const { data, error } = await supabase
    .from("team_guide_tracks")
    .select("id, team_id, setlist_id, song_id, created_by, guide_track_data")
    .eq("id", guideTrackId)
    .maybeSingle<GuideTrackRow>();

  if (error) throw new RecordingApiError(error.message || "가이드 트랙을 확인하지 못했습니다.", 500);
  if (!data) throw new RecordingApiError("가이드 트랙을 찾을 수 없습니다.", 404);
  return data;
}

async function getSetlistOrThrow(supabase: SupabaseClient, setlistId: string) {
  const { data, error } = await supabase
    .from("setlists")
    .select("id, user_id, team_id")
    .eq("id", setlistId)
    .maybeSingle<SetlistRow>();

  if (error) throw new RecordingApiError(error.message || "콘티 권한을 확인하지 못했습니다.", 500);
  if (!data) throw new RecordingApiError("콘티를 찾을 수 없습니다.", 404);
  return data;
}

async function getTrackOrThrow(supabase: SupabaseClient, trackId: string) {
  const { data, error } = await supabase
    .from("team_recording_tracks")
    .select("*")
    .eq("id", trackId)
    .maybeSingle<RecordingTrackRow>();

  if (error) throw new RecordingApiError(error.message || "녹음 트랙을 확인하지 못했습니다.", 500);
  if (!data) throw new RecordingApiError("녹음 트랙을 찾을 수 없습니다.", 404);
  return data;
}

async function assertMixTrackKeyBelongsToSession(supabase: SupabaseClient, sessionId: string, trackKey: string) {
  if (trackKey === "guide" || trackKey === "master") return;
  if (!trackKey.startsWith("recording:")) {
    throw new RecordingApiError("지원하지 않는 믹서 트랙입니다.", 400);
  }

  const trackId = trackKey.replace(/^recording:/, "");
  const { data, error } = await supabase
    .from("team_recording_tracks")
    .select("id")
    .eq("id", trackId)
    .eq("session_id", sessionId)
    .neq("status", "deleted")
    .maybeSingle<{ id: string }>();

  if (error) throw new RecordingApiError(error.message || "믹서 트랙을 확인하지 못했습니다.", 500);
  if (!data) throw new RecordingApiError("이 녹음실에 없는 트랙입니다.", 400);
}

async function assertCanAccessRecording(
  supabase: SupabaseClient,
  userId: string,
  session: RecordingSessionRow,
  setlist: SetlistRow,
) {
  if (session.team_id) {
    const { data, error } = await supabase
      .from("team_memberships")
      .select("id")
      .eq("team_id", session.team_id)
      .eq("user_id", userId)
      .eq("status", "approved")
      .is("removed_at", null)
      .maybeSingle<{ id: string }>();

    if (error) throw new RecordingApiError(error.message || "팀 권한을 확인하지 못했습니다.", 500);
    if (!data) throw new RecordingApiError("이 팀 녹음실에 접근할 권한이 없습니다.", 403);
    return;
  }

  if (setlist.user_id !== userId) {
    throw new RecordingApiError("개인 콘티 녹음실에 접근할 권한이 없습니다.", 403);
  }
}

async function assertCanManageRecordingSession(
  supabase: SupabaseClient,
  userId: string,
  guideTrack: GuideTrackRow,
  setlist: SetlistRow,
) {
  if (guideTrack.created_by === userId || setlist.user_id === userId) return;

  if (guideTrack.team_id) {
    const { data, error } = await supabase
      .from("team_memberships")
      .select("id")
      .eq("team_id", guideTrack.team_id)
      .eq("user_id", userId)
      .eq("status", "approved")
      .in("role", ["owner", "admin"])
      .is("removed_at", null)
      .maybeSingle<{ id: string }>();

    if (error) throw new RecordingApiError(error.message || "팀 권한을 확인하지 못했습니다.", 500);
    if (!data) throw new RecordingApiError("팀 녹음실을 만들 권한이 없습니다.", 403);
    return;
  }

  throw new RecordingApiError("팀 녹음실을 만들 권한이 없습니다.", 403);
}

async function assertCanModifyRecordingTrack(
  supabase: SupabaseClient,
  userId: string,
  track: RecordingTrackRow,
  session: RecordingSessionRow,
  setlist: SetlistRow,
) {
  if (track.user_id === userId) return;

  if (session.team_id) {
    const { data, error } = await supabase
      .from("team_memberships")
      .select("id")
      .eq("team_id", session.team_id)
      .eq("user_id", userId)
      .eq("status", "approved")
      .in("role", ["owner", "admin"])
      .is("removed_at", null)
      .maybeSingle<{ id: string }>();

    if (error) throw new RecordingApiError(error.message || "팀 권한을 확인하지 못했습니다.", 500);
    if (!data) throw new RecordingApiError("이 녹음을 수정하거나 삭제할 권한이 없습니다.", 403);
    return;
  }

  if (setlist.user_id !== userId) {
    throw new RecordingApiError("이 녹음을 수정하거나 삭제할 권한이 없습니다.", 403);
  }
}

async function getRecordingQuotaContext(supabase: SupabaseClient, userId: string, teamId: string) {
  const [profile, limits] = await Promise.all([getUserLabProfile(supabase, userId), getTeamRecordingLimits(supabase, teamId)]);
  return {
    limits,
    profile,
    bypassLimits: shouldBypassRecordingLimits(profile) || limits.isUnlimited,
  };
}

async function getUserLabProfile(supabase: SupabaseClient, userId: string): Promise<ProfileLabRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("lab_enabled")
    .eq("id", userId)
    .maybeSingle<ProfileLabRow>();

  if (error) return null;
  return data ?? null;
}

async function getTeamRecordingLimits(supabase: SupabaseClient, teamId: string): Promise<RecordingLimitConfig> {
  const { data, error } = await supabase
    .from("team_recording_limits")
    .select(
      "plan, monthly_sessions_limit, tracks_per_session_limit, versions_per_user_part_limit, max_track_size_bytes, max_track_duration_seconds, retention_days, is_unlimited",
    )
    .eq("team_id", teamId)
    .maybeSingle<TeamRecordingLimitRow>();

  if (error || !data) return getDefaultRecordingLimitConfig();
  const defaults = getDefaultRecordingLimitConfig();
  return {
    plan: data.plan || defaults.plan,
    monthlySessionsLimit: normalizeInteger(data.monthly_sessions_limit, defaults.monthlySessionsLimit),
    tracksPerSessionLimit: normalizeInteger(data.tracks_per_session_limit, defaults.tracksPerSessionLimit),
    versionsPerUserPartLimit: normalizeInteger(data.versions_per_user_part_limit, defaults.versionsPerUserPartLimit),
    maxTrackSizeBytes: normalizeInteger(data.max_track_size_bytes, defaults.maxTrackSizeBytes),
    maxTrackDurationSeconds: normalizeInteger(data.max_track_duration_seconds, defaults.maxTrackDurationSeconds),
    retentionDays: normalizeInteger(data.retention_days, defaults.retentionDays),
    isUnlimited: Boolean(data.is_unlimited),
  };
}

async function getMonthlySessionCountForLimit(supabase: SupabaseClient, teamId: string) {
  const yearMonth = getCurrentRecordingYearMonth();
  const usage = await getMonthlyRecordingUsage(supabase, teamId, yearMonth);
  const { startIso, endIso } = getMonthRange(yearMonth);
  const { count, error } = await supabase
    .from("team_recording_sessions")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  if (error) return usage?.sessions_created_count ?? 0;
  return Math.max(usage?.sessions_created_count ?? 0, count ?? 0);
}

async function countActiveTracksInSession(supabase: SupabaseClient, sessionId: string) {
  const { count, error } = await supabase
    .from("team_recording_tracks")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("status", "active");

  if (error) throw new RecordingApiError(error.message || "녹음 트랙 수를 확인하지 못했습니다.", 500);
  return count ?? 0;
}

async function getMonthlyRecordingUsage(supabase: SupabaseClient, teamId: string, yearMonth = getCurrentRecordingYearMonth()) {
  const { data } = await supabase
    .from("team_recording_usage_monthly")
    .select("team_id, year_month, sessions_created_count, tracks_uploaded_count, storage_bytes_used")
    .eq("team_id", teamId)
    .eq("year_month", yearMonth)
    .maybeSingle<TeamRecordingUsageMonthlyRow>();

  return data ?? null;
}

async function incrementMonthlyRecordingUsage(
  supabase: SupabaseClient,
  teamId: string,
  delta: { sessionsDelta?: number; tracksDelta?: number; storageBytesDelta?: number },
) {
  const yearMonth = getCurrentRecordingYearMonth();
  const current = await getMonthlyRecordingUsage(supabase, teamId, yearMonth);
  const next = {
    team_id: teamId,
    year_month: yearMonth,
    sessions_created_count: (current?.sessions_created_count ?? 0) + (delta.sessionsDelta ?? 0),
    tracks_uploaded_count: (current?.tracks_uploaded_count ?? 0) + (delta.tracksDelta ?? 0),
    storage_bytes_used: Number(current?.storage_bytes_used ?? 0) + (delta.storageBytesDelta ?? 0),
    updated_at: new Date().toISOString(),
  };

  const query = current
    ? supabase
        .from("team_recording_usage_monthly")
        .update(next)
        .eq("team_id", teamId)
        .eq("year_month", yearMonth)
    : supabase.from("team_recording_usage_monthly").insert(next);

  const { error } = await query;
  if (error) throw error;
}

async function enforceVersionsPerUserPartLimit(supabase: SupabaseClient, track: RecordingTrackRow, limit: number) {
  if (!track.user_id || limit <= 0) return;

  const baseQuery = supabase
    .from("team_recording_tracks")
    .select("*")
    .eq("session_id", track.session_id)
    .eq("user_id", track.user_id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const { data, error } = track.part
    ? await baseQuery.eq("part", track.part).returns<RecordingTrackRow[]>()
    : await baseQuery.is("part", null).returns<RecordingTrackRow[]>();
  if (error || !data || data.length <= limit) return;

  const staleTracks = data.slice(limit);
  for (const staleTrack of staleTracks) {
    await supabase
      .from("team_recording_tracks")
      .update({
        status: "replaced",
        updated_at: new Date().toISOString(),
      })
      .eq("id", staleTrack.id);

    const deleteResult = await safeDeleteR2Object(staleTrack.object_key);
    await supabase
      .from("team_recording_tracks")
      .update({
        object_key: deleteResult.ok ? null : staleTrack.object_key,
        error_message: deleteResult.ok ? null : `r2_replaced_delete_failed: ${deleteResult.error ?? "unknown"}`.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", staleTrack.id);
  }
}

async function createRecordingUploadedNotification(supabase: SupabaseClient, track: RecordingTrackRow) {
  if (!track.team_id || !track.user_id) return;

  const { data: memberships } = await supabase
    .from("team_memberships")
    .select("user_id, role")
    .eq("team_id", track.team_id)
    .eq("status", "approved")
    .in("role", ["owner", "admin"])
    .is("removed_at", null)
    .returns<Array<{ user_id: string; role: string }>>();

  const { data: guideTrack } = await supabase
    .from("team_guide_tracks")
    .select("created_by")
    .eq("id", track.guide_track_id)
    .maybeSingle<{ created_by: string | null }>();

  const recipients = new Set((memberships ?? []).map((membership) => membership.user_id));
  if (guideTrack?.created_by) recipients.add(guideTrack.created_by);
  recipients.delete(track.user_id);
  if (recipients.size === 0) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", track.user_id)
    .maybeSingle<{ display_name: string | null }>();

  const senderName = profile?.display_name?.trim() || "팀원";
  const part = track.part?.trim() || "파트";

  const { error } = await supabase.from("notifications").insert(
    Array.from(recipients).map((userId) => ({
      user_id: userId,
      team_id: track.team_id,
      type: "team_recording_track_uploaded",
      title: "새 녹음 트랙이 업로드되었습니다",
      body: `${senderName}님이 ${part} 녹음을 업로드했습니다.`,
      link_url: `/guide-tracks/${track.guide_track_id}/studio`,
      source_type: "team_recording_track",
      source_id: track.id,
    })),
  );

  if (error && error.code !== "23505") throw error;
}

function normalizeDuration(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) return null;
  return Math.round(numberValue * 100) / 100;
}

function normalizeRecordingInputType(value: unknown) {
  return value === "mic" || value === "line" || value === "interface" || value === "unknown" ? value : "mic";
}

function sanitizeRecordingMixSetting(input: RecordingMixSettingInput): SanitizedRecordingMixSetting {
  const trackKey = normalizeMixTrackKey(input.trackKey);
  const effects = normalizeTrackEffects({
    ...input.effects,
    reverb: input.effects?.reverb
      ? {
          ...input.effects.reverb,
          amount: normalizeReverbAmount(input.effects.reverb.amount),
        }
      : undefined,
  });

  return {
    trackKey,
    volume: clampNumber(input.volume, 0, 1.5, trackKey === "guide" ? 0.8 : 1),
    pan: clampNumber(input.pan, -1, 1, 0),
    muted: Boolean(input.muted),
    solo: Boolean(input.solo),
    latencyOffsetMs: Math.max(-2000, Math.min(2000, normalizeInteger(input.latencyOffsetMs, 0))),
    effects,
  };
}

function normalizeMixTrackKey(value: unknown) {
  const trackKey = String(value ?? "").trim();
  if (trackKey === "guide" || trackKey === "master") return trackKey;
  if (/^recording:[0-9a-fA-F-]{20,}$/.test(trackKey)) return trackKey;
  throw new RecordingApiError("믹서 트랙 정보가 올바르지 않습니다.", 400);
}

function normalizeReverbAmount(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return DEFAULT_TRACK_EFFECTS.reverb.amount;
  return numberValue > 1 ? numberValue / 100 : numberValue;
}

function normalizeInteger(value: unknown, fallback: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.round(numberValue);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(min, Math.min(max, numberValue));
}

function rowToApiTrack(row: RecordingTrackRow) {
  return {
    id: row.id,
    sessionId: row.session_id,
    teamId: row.team_id ?? undefined,
    guideTrackId: row.guide_track_id,
    userId: row.user_id ?? undefined,
    part: row.part ?? undefined,
    title: row.title,
    storageProvider: row.storage_provider,
    bucket: row.bucket ?? undefined,
    objectKey: row.object_key ?? undefined,
    mimeType: row.mime_type ?? undefined,
    durationSeconds: row.duration_seconds ?? undefined,
    sizeBytes: row.size_bytes ?? undefined,
    inputType: row.input_type,
    deviceLabel: row.device_label ?? undefined,
    latencyOffsetMs: row.latency_offset_ms ?? 0,
    recordingOffsetMs: row.recording_offset_ms ?? 0,
    guideTrackSnapshot: row.guide_track_snapshot,
    notes: row.notes ?? undefined,
    status: row.status,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToApiSession(row: RecordingSessionRow) {
  return {
    id: row.id,
    teamId: row.team_id ?? undefined,
    setlistId: row.setlist_id,
    songId: row.song_id,
    guideTrackId: row.guide_track_id,
    title: row.title,
    status: row.status,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToApiMixSetting(row: RecordingMixSettingRow): RecordingMixSetting {
  const compressorPreset: TrackEffectSettings["compressor"]["preset"] =
    row.compressor_preset === "light" || row.compressor_preset === "medium" || row.compressor_preset === "strong"
      ? row.compressor_preset
      : "off";
  const reverbType: TrackEffectSettings["reverb"]["type"] =
    row.reverb_type === "small_room" || row.reverb_type === "chapel" || row.reverb_type === "wide_hall"
      ? row.reverb_type
      : "off";
  const effects = normalizeTrackEffects({
    gainDb: Number(row.gain_db ?? 0),
    eq: {
      lowGainDb: Number(row.eq_low_gain_db ?? 0),
      midGainDb: Number(row.eq_mid_gain_db ?? 0),
      highGainDb: Number(row.eq_high_gain_db ?? 0),
    },
    compressor: {
      enabled: Boolean(row.compressor_enabled),
      preset: compressorPreset,
    },
    reverb: {
      type: reverbType,
      amount: normalizeReverbAmount(row.reverb_amount),
    },
  });

  return {
    id: row.id,
    sessionId: row.session_id,
    trackKey: row.track_key,
    volume: clampNumber(row.volume, 0, 1.5, row.track_key === "guide" ? 0.8 : 1),
    pan: clampNumber(row.pan, -1, 1, 0),
    muted: Boolean(row.muted),
    solo: Boolean(row.solo),
    latencyOffsetMs: normalizeInteger(row.latency_offset_ms, 0),
    effects,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class RecordingApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}
