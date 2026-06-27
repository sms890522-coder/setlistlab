"use client";

import { getCurrentSession } from "@/lib/auth";
import type { Profile } from "@/lib/db/profiles";
import {
  formatRecordingLimitBytes,
  getCurrentRecordingYearMonth,
  getDefaultRecordingLimitConfig,
  getMonthRange,
  type RecordingLimitConfig,
} from "@/lib/recording/recordingLimits";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type RecordingSessionStatus = "open" | "closed" | "archived";
export type RecordingTrackStatus = "pending_upload" | "uploading" | "active" | "replaced" | "failed" | "deleted";
export type RecordingInputType = "mic" | "line" | "interface" | "unknown";

export type TeamRecordingSession = {
  id: string;
  teamId?: string;
  setlistId: string;
  songId: string;
  guideTrackId: string;
  title: string;
  status: RecordingSessionStatus;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type TeamRecordingTrack = {
  id: string;
  sessionId: string;
  teamId?: string;
  guideTrackId: string;
  userId?: string;
  part?: string;
  title: string;
  storageProvider: "r2" | string;
  bucket?: string;
  objectKey?: string;
  audioUrl?: string;
  filePath?: string;
  mimeType?: string;
  durationSeconds?: number;
  sizeBytes?: number;
  inputType: RecordingInputType;
  deviceLabel?: string;
  latencyOffsetMs: number;
  recordingOffsetMs: number;
  guideTrackSnapshot: unknown;
  notes?: string;
  status: RecordingTrackStatus;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  profile?: Pick<Profile, "id" | "displayName" | "avatarUrl" | "role"> | null;
};

export type TeamRecordingUsageSummary = {
  yearMonth: string;
  limits: RecordingLimitConfig;
  monthlySessionsUsed: number;
  monthlyTracksUploaded: number;
  monthlyStorageBytesUploaded: number;
  activeStorageBytes: number;
  activeTracksCount: number;
};

type RecordingSessionRow = {
  id: string;
  team_id: string | null;
  setlist_id: string;
  song_id: string;
  guide_track_id: string;
  title: string;
  status: RecordingSessionStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
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
  audio_url: string | null;
  file_path: string | null;
  mime_type: string | null;
  duration_seconds: number | string | null;
  size_bytes: number | string | null;
  input_type: RecordingInputType;
  device_label: string | null;
  latency_offset_ms: number | null;
  recording_offset_ms: number | null;
  guide_track_snapshot: unknown;
  notes: string | null;
  status: RecordingTrackStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
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
  sessions_created_count: number | null;
  tracks_uploaded_count: number | null;
  storage_bytes_used: number | string | null;
};

export async function getRecordingSessionForGuideTrack(guideTrackId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_recording_sessions")
    .select("*")
    .eq("guide_track_id", guideTrackId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<RecordingSessionRow>();

  if (error) throw new Error(error.message || "녹음 세션을 불러오지 못했습니다.");
  return data ? rowToSession(data) : null;
}

export async function createRecordingSession(input: {
  teamId?: string;
  setlistId: string;
  songId: string;
  guideTrackId: string;
  title: string;
}) {
  const session = await getCurrentSession();
  const token = session?.access_token;
  if (!token) throw new Error("로그인이 필요합니다.");

  const response = await fetch("/api/recordings/create-session", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => ({}))) as { session?: TeamRecordingSession; error?: string };
  if (!response.ok || !payload.session) {
    throw new Error(payload.error || "녹음 세션을 만들지 못했습니다.");
  }

  return payload.session;
}

export async function getRecordingTracks(sessionId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_recording_tracks")
    .select("*")
    .eq("session_id", sessionId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .returns<RecordingTrackRow[]>();

  if (error) throw new Error(error.message || "녹음 목록을 불러오지 못했습니다.");

  const tracks = (data ?? []).map(rowToTrack);
  const userIds = Array.from(new Set(tracks.map((track) => track.userId).filter(Boolean))) as string[];
  if (userIds.length === 0) return tracks;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, role")
    .in("id", userIds)
    .returns<ProfileRow[]>();

  const profileById = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      {
        id: profile.id,
        displayName: profile.display_name || "팀원",
        avatarUrl: profile.avatar_url ?? undefined,
        role: profile.role || "팀원",
      },
    ]),
  );

  return tracks.map((track) => ({ ...track, profile: track.userId ? profileById.get(track.userId) ?? null : null }));
}

export async function getTeamRecordingUsageSummary(teamId: string): Promise<TeamRecordingUsageSummary> {
  const supabase = getSupabaseBrowserClient();
  const yearMonth = getCurrentRecordingYearMonth();
  const { startIso, endIso } = getMonthRange(yearMonth);
  const defaults = getDefaultRecordingLimitConfig();

  const [limitsResult, usageResult, monthlySessionsResult, activeTracksResult] = await Promise.all([
    supabase
      .from("team_recording_limits")
      .select(
        "plan, monthly_sessions_limit, tracks_per_session_limit, versions_per_user_part_limit, max_track_size_bytes, max_track_duration_seconds, retention_days, is_unlimited",
      )
      .eq("team_id", teamId)
      .maybeSingle<TeamRecordingLimitRow>(),
    supabase
      .from("team_recording_usage_monthly")
      .select("sessions_created_count, tracks_uploaded_count, storage_bytes_used")
      .eq("team_id", teamId)
      .eq("year_month", yearMonth)
      .maybeSingle<TeamRecordingUsageMonthlyRow>(),
    supabase
      .from("team_recording_sessions")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .gte("created_at", startIso)
      .lt("created_at", endIso),
    supabase.from("team_recording_tracks").select("size_bytes").eq("team_id", teamId).eq("status", "active").returns<Array<{ size_bytes: number | string | null }>>(),
  ]);

  const limitRow = limitsResult.error ? null : limitsResult.data;
  const usageRow = usageResult.error ? null : usageResult.data;
  const limits: RecordingLimitConfig = limitRow
    ? {
        plan: limitRow.plan || defaults.plan,
        monthlySessionsLimit: Number(limitRow.monthly_sessions_limit ?? defaults.monthlySessionsLimit),
        tracksPerSessionLimit: Number(limitRow.tracks_per_session_limit ?? defaults.tracksPerSessionLimit),
        versionsPerUserPartLimit: Number(limitRow.versions_per_user_part_limit ?? defaults.versionsPerUserPartLimit),
        maxTrackSizeBytes: Number(limitRow.max_track_size_bytes ?? defaults.maxTrackSizeBytes),
        maxTrackDurationSeconds: Number(limitRow.max_track_duration_seconds ?? defaults.maxTrackDurationSeconds),
        retentionDays: Number(limitRow.retention_days ?? defaults.retentionDays),
        isUnlimited: Boolean(limitRow.is_unlimited),
      }
    : defaults;

  const activeTracks = activeTracksResult.error ? [] : activeTracksResult.data ?? [];
  const activeStorageBytes = activeTracks.reduce((sum, track) => sum + Number(track.size_bytes ?? 0), 0);
  const monthlySessionCount = Math.max(
    Number(usageRow?.sessions_created_count ?? 0),
    monthlySessionsResult.error ? 0 : monthlySessionsResult.count ?? 0,
  );

  return {
    yearMonth,
    limits,
    monthlySessionsUsed: monthlySessionCount,
    monthlyTracksUploaded: Number(usageRow?.tracks_uploaded_count ?? 0),
    monthlyStorageBytesUploaded: Number(usageRow?.storage_bytes_used ?? 0),
    activeStorageBytes,
    activeTracksCount: activeTracks.length,
  };
}

export function formatRecordingUsageBytes(bytes: number) {
  return formatRecordingLimitBytes(bytes);
}

export async function markRecordingTrackDeleted(trackId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("team_recording_tracks")
    .update({
      status: "deleted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", trackId);

  if (error) throw new Error(error.message || "녹음을 삭제하지 못했습니다.");
}

function rowToSession(row: RecordingSessionRow): TeamRecordingSession {
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

function rowToTrack(row: RecordingTrackRow): TeamRecordingTrack {
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
    audioUrl: row.audio_url ?? undefined,
    filePath: row.file_path ?? undefined,
    mimeType: row.mime_type ?? undefined,
    durationSeconds: row.duration_seconds === null ? undefined : Number(row.duration_seconds),
    sizeBytes: row.size_bytes === null ? undefined : Number(row.size_bytes),
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
