import { randomUUID } from "crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  MAX_RECORDING_UPLOAD_BYTES,
  RECORDING_PRESIGNED_EXPIRES_IN_SECONDS,
  buildRecordingObjectKey,
  createPresignedReadUrl,
  createPresignedUploadUrl,
  getR2ObjectMetadata,
  getRecordingBucket,
  normalizeRecordingMimeType,
} from "@/lib/storage/r2";
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
  deviceLabel?: string;
  recordingOffsetMs?: number;
  latencyOffsetMs?: number;
}) {
  const { supabase, user } = await getRecordingAccessContext(input.request);
  const mimeType = normalizeRecordingMimeType(input.mimeType);
  const sizeBytes = Number(input.sizeBytes);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) throw new RecordingApiError("녹음 파일 크기를 확인할 수 없습니다.", 400);
  if (sizeBytes > MAX_RECORDING_UPLOAD_BYTES) {
    throw new RecordingApiError("녹음 파일이 너무 큽니다. 50MB 이하로 다시 녹음해 주세요.", 413);
  }

  const session = await getSessionOrThrow(supabase, input.sessionId);
  if (session.status !== "open") throw new RecordingApiError("닫힌 녹음 세션에는 업로드할 수 없습니다.", 403);
  if (session.guide_track_id !== input.guideTrackId) throw new RecordingApiError("가이드 트랙 정보가 일치하지 않습니다.", 400);

  const guideTrack = await getGuideTrackOrThrow(supabase, input.guideTrackId);
  const setlist = await getSetlistOrThrow(supabase, session.setlist_id);
  await assertCanAccessRecording(supabase, user.id, session, setlist);

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
    duration_seconds: normalizeDuration(input.durationSeconds),
    size_bytes: sizeBytes,
    input_type: "mic",
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

function normalizeInteger(value: unknown, fallback: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.round(numberValue);
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

export class RecordingApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}
