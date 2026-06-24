"use client";

import { getCurrentUser } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type GuideTrackStatus = "draft" | "ready" | "generated" | "failed";
export type GuideTrackExtractionStatus = "pending" | "extracting" | "extracted" | "failed" | "manual";

export type ExtractedChord = {
  chord: string;
  rawText?: string;
  confidence?: number;
  source: "image" | "manual";
};

export type GuideTrackSection = {
  sectionId: string;
  label: string;
  chords: string[];
  bars: number;
  repeat: number;
  memo?: string;
};

export type GuideTrackData = {
  bpm?: number;
  key?: string;
  timeSignature: string;
  sound: "piano" | "pad" | "piano_pad" | "click_only";
  click: boolean;
  countIn: number;
  // TODO: 팀 녹음실에서는 이 sections/timing 데이터를 기준 트랙 싱크 기준으로 재사용한다.
  sections: GuideTrackSection[];
  totalBars: number;
};

export type TeamGuideTrack = {
  id: string;
  teamId?: string;
  setlistId: string;
  songId: string;
  createdBy?: string;
  title: string;
  status: GuideTrackStatus;
  sourceScoreImageUrl?: string;
  extractionStatus: GuideTrackExtractionStatus;
  extractedChords: ExtractedChord[];
  songFormMap: GuideTrackSection[];
  guideTrackData: GuideTrackData;
  audioUrl?: string;
  midiUrl?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export type TeamGuideTrackInput = {
  id?: string;
  teamId?: string;
  setlistId: string;
  songId: string;
  title: string;
  status?: GuideTrackStatus;
  sourceScoreImageUrl?: string;
  extractionStatus?: GuideTrackExtractionStatus;
  extractedChords?: ExtractedChord[];
  songFormMap?: GuideTrackSection[];
  guideTrackData?: GuideTrackData;
  audioUrl?: string;
  midiUrl?: string;
  errorMessage?: string;
};

type TeamGuideTrackRow = {
  id: string;
  team_id: string | null;
  setlist_id: string;
  song_id: string;
  created_by: string | null;
  title: string;
  status: GuideTrackStatus;
  source_score_image_url: string | null;
  extraction_status: GuideTrackExtractionStatus;
  extracted_chords: ExtractedChord[] | null;
  song_form_map: GuideTrackSection[] | null;
  guide_track_data: GuideTrackData | null;
  audio_url: string | null;
  midi_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export async function getGuideTracksForSong(setlistId: string, songId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_guide_tracks")
    .select("*")
    .eq("setlist_id", setlistId)
    .eq("song_id", songId)
    .order("updated_at", { ascending: false })
    .returns<TeamGuideTrackRow[]>();

  if (error) throw new Error(error.message || "가이드 트랙을 불러오지 못했습니다.");
  return (data ?? []).map(rowToGuideTrack);
}

export async function getFirstGuideTrackForSong(setlistId: string, songId: string) {
  const tracks = await getGuideTracksForSong(setlistId, songId);
  return tracks[0] ?? null;
}

export async function getGuideTrackSongIds(setlistId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_guide_tracks")
    .select("song_id")
    .eq("setlist_id", setlistId)
    .returns<Array<{ song_id: string }>>();

  if (error) throw new Error(error.message || "가이드 트랙 정보를 불러오지 못했습니다.");
  return new Set((data ?? []).map((row) => row.song_id));
}

export async function getGuideTrack(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("team_guide_tracks").select("*").eq("id", id).maybeSingle<TeamGuideTrackRow>();

  if (error) throw new Error(error.message || "가이드 트랙을 불러오지 못했습니다.");
  return data ? rowToGuideTrack(data) : null;
}

export async function saveGuideTrack(input: TeamGuideTrackInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const supabase = getSupabaseBrowserClient();
  const payload = {
    team_id: input.teamId || null,
    setlist_id: input.setlistId,
    song_id: input.songId,
    created_by: user.id,
    title: input.title.trim() || "팀 가이드 트랙",
    status: input.status ?? "ready",
    source_score_image_url: input.sourceScoreImageUrl || null,
    extraction_status: input.extractionStatus ?? "manual",
    extracted_chords: input.extractedChords ?? [],
    song_form_map: input.songFormMap ?? [],
    guide_track_data: input.guideTrackData ?? createEmptyGuideTrackData(),
    audio_url: input.audioUrl || null,
    midi_url: input.midiUrl || null,
    error_message: input.errorMessage || null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("team_guide_tracks")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single<TeamGuideTrackRow>();

    if (error) throw new Error(error.message || "가이드 트랙을 저장하지 못했습니다.");
    return rowToGuideTrack(data);
  }

  const { data, error } = await supabase
    .from("team_guide_tracks")
    .insert(payload)
    .select("*")
    .single<TeamGuideTrackRow>();

  if (error) throw new Error(error.message || "가이드 트랙을 저장하지 못했습니다.");
  return rowToGuideTrack(data);
}

function createEmptyGuideTrackData(): GuideTrackData {
  return {
    timeSignature: "4/4",
    sound: "piano_pad",
    click: true,
    countIn: 1,
    sections: [],
    totalBars: 0,
  };
}

function rowToGuideTrack(row: TeamGuideTrackRow): TeamGuideTrack {
  return {
    id: row.id,
    teamId: row.team_id ?? undefined,
    setlistId: row.setlist_id,
    songId: row.song_id,
    createdBy: row.created_by ?? undefined,
    title: row.title,
    status: row.status,
    sourceScoreImageUrl: row.source_score_image_url ?? undefined,
    extractionStatus: row.extraction_status,
    extractedChords: Array.isArray(row.extracted_chords) ? row.extracted_chords : [],
    songFormMap: Array.isArray(row.song_form_map) ? row.song_form_map : [],
    guideTrackData: row.guide_track_data ?? createEmptyGuideTrackData(),
    audioUrl: row.audio_url ?? undefined,
    midiUrl: row.midi_url ?? undefined,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
