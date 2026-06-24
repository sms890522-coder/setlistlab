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

export type GuideTrackMetronome = {
  enabled: boolean;
  sound: "click";
  accentFirstBeat: boolean;
  volume: number;
};

export type GuideTrackCountIn = {
  enabled: boolean;
  bars: number;
  click: boolean;
  visualCounter: boolean;
};

export type GuideTrackVoiceCue = {
  enabled: boolean;
  language: "en" | "ko";
  announceSections: boolean;
  announceBeforeBeats: 1 | 4;
  volume: number;
};

export type GuideTrackDownload = {
  format: "wav" | "json";
  lastExportedAt: string | null;
};

export type GuideTrackData = {
  bpm?: number;
  key?: string;
  timeSignature: string;
  sound: "piano" | "pad" | "piano_pad" | "click_only";
  metronome: GuideTrackMetronome;
  countIn: GuideTrackCountIn;
  voiceCue: GuideTrackVoiceCue;
  download: GuideTrackDownload;
  /** @deprecated 이전 MVP 데이터 호환용. 새 저장에는 metronome.enabled를 사용한다. */
  click?: boolean;
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
  guide_track_data: unknown;
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
    guide_track_data: normalizeGuideTrackData(input.guideTrackData),
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

export function createEmptyGuideTrackData(): GuideTrackData {
  return {
    timeSignature: "4/4",
    sound: "piano_pad",
    metronome: createDefaultMetronome(),
    countIn: createDefaultCountIn(),
    voiceCue: createDefaultVoiceCue(),
    download: {
      format: "wav",
      lastExportedAt: null,
    },
    sections: [],
    totalBars: 0,
  };
}

export function normalizeGuideTrackData(value: unknown): GuideTrackData {
  const base = createEmptyGuideTrackData();
  if (!isRecord(value)) return base;

  const legacyCountIn = typeof value.countIn === "number" ? value.countIn : undefined;
  const legacyClick = typeof value.click === "boolean" ? value.click : undefined;
  const sections = Array.isArray(value.sections)
    ? value.sections.map(normalizeGuideTrackSection).filter((section): section is GuideTrackSection => Boolean(section))
    : base.sections;
  const metronome = isRecord(value.metronome)
    ? {
        enabled: typeof value.metronome.enabled === "boolean" ? value.metronome.enabled : legacyClick ?? true,
        sound: "click" as const,
        accentFirstBeat: typeof value.metronome.accentFirstBeat === "boolean" ? value.metronome.accentFirstBeat : true,
        volume: normalizeVolume(value.metronome.volume, 0.7),
      }
    : {
        ...createDefaultMetronome(),
        enabled: legacyClick ?? true,
      };
  const countIn = isRecord(value.countIn)
    ? {
        enabled: typeof value.countIn.enabled === "boolean" ? value.countIn.enabled : true,
        bars: normalizeInteger(value.countIn.bars, 1, 0, 2),
        click: typeof value.countIn.click === "boolean" ? value.countIn.click : true,
        // 이전 데이터의 countIn.voice는 브라우저별 지연 때문에 더 이상 사용하지 않는다.
        visualCounter: typeof value.countIn.visualCounter === "boolean" ? value.countIn.visualCounter : true,
      }
    : {
        ...createDefaultCountIn(),
        enabled: legacyCountIn !== undefined ? legacyCountIn > 0 : true,
        bars: normalizeInteger(legacyCountIn ?? 1, 1, 0, 2),
      };
  const voiceCue: GuideTrackVoiceCue = isRecord(value.voiceCue)
    ? {
        enabled: typeof value.voiceCue.enabled === "boolean" ? value.voiceCue.enabled : true,
        language: value.voiceCue.language === "ko" ? "ko" : "en",
        announceSections: typeof value.voiceCue.announceSections === "boolean" ? value.voiceCue.announceSections : true,
        announceBeforeBeats: value.voiceCue.announceBeforeBeats === 4 ? 4 : 1,
        volume: normalizeVolume(value.voiceCue.volume, 0.9),
      }
    : createDefaultVoiceCue();
  const download: GuideTrackDownload = isRecord(value.download)
    ? {
        format: value.download.format === "json" ? "json" : "wav",
        lastExportedAt: typeof value.download.lastExportedAt === "string" ? value.download.lastExportedAt : null,
      }
    : base.download;

  return {
    bpm: typeof value.bpm === "number" && Number.isFinite(value.bpm) ? value.bpm : undefined,
    key: typeof value.key === "string" ? value.key : undefined,
    timeSignature: typeof value.timeSignature === "string" && value.timeSignature ? value.timeSignature : base.timeSignature,
    sound: isGuideTrackSound(value.sound) ? value.sound : base.sound,
    metronome,
    countIn,
    voiceCue,
    download,
    click: legacyClick,
    sections,
    totalBars:
      typeof value.totalBars === "number" && Number.isFinite(value.totalBars)
        ? value.totalBars
        : sections.reduce((sum, section) => sum + section.bars * section.repeat, 0),
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
    guideTrackData: normalizeGuideTrackData(row.guide_track_data),
    audioUrl: row.audio_url ?? undefined,
    midiUrl: row.midi_url ?? undefined,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createDefaultMetronome(): GuideTrackMetronome {
  return {
    enabled: true,
    sound: "click",
    accentFirstBeat: true,
    volume: 0.7,
  };
}

function createDefaultCountIn(): GuideTrackCountIn {
  return {
    enabled: true,
    bars: 1,
    click: true,
    visualCounter: true,
  };
}

function createDefaultVoiceCue(): GuideTrackVoiceCue {
  return {
    enabled: true,
    language: "en",
    announceSections: true,
    announceBeforeBeats: 1,
    volume: 0.9,
  };
}

function normalizeGuideTrackSection(value: unknown): GuideTrackSection | null {
  if (!isRecord(value)) return null;
  const label = typeof value.label === "string" && value.label.trim() ? value.label.trim() : "Section";
  return {
    sectionId: typeof value.sectionId === "string" && value.sectionId.trim() ? value.sectionId.trim() : label,
    label,
    chords: Array.isArray(value.chords) ? value.chords.filter((chord): chord is string => typeof chord === "string" && Boolean(chord.trim())) : [],
    bars: normalizeInteger(value.bars, 4, 1, 64),
    repeat: normalizeInteger(value.repeat, 1, 1, 32),
    memo: typeof value.memo === "string" ? value.memo : "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGuideTrackSound(value: unknown): value is GuideTrackData["sound"] {
  return value === "piano" || value === "pad" || value === "piano_pad" || value === "click_only";
}

function normalizeInteger(value: unknown, fallback: number, min: number, max: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function normalizeVolume(value: unknown, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(1, Math.max(0, number));
}
