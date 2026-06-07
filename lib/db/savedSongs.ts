"use client";

import { createId } from "@/lib/id";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { SavedSong, Song } from "@/lib/types";
import { extractYouTubeVideoId } from "@/lib/youtube";

type SavedSongRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  youtube_url: string | null;
  youtube_video_id: string | null;
  original_key: string | null;
  practice_key: string | null;
  bpm: number | null;
  song_data: Song | null;
  created_at: string;
  updated_at: string;
};

export async function getCloudSongLibrary() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("saved_songs")
    .select("*")
    .order("updated_at", { ascending: false })
    .returns<SavedSongRow[]>();

  if (error) {
    throw new Error(error.message || "곡 보관함을 불러오지 못했습니다.");
  }

  return (data ?? []).map(rowToSavedSong);
}

export async function getCloudSavedSongByTitle(title: string) {
  const normalizedTitle = normalizeSongTitle(title);
  const library = await getCloudSongLibrary();
  return library.find((item) => normalizeSongTitle(item.song.title) === normalizedTitle) ?? null;
}

export async function saveCloudSongToLibrary(song: Song, overwrite = false) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  const normalizedSong = normalizeSong(song);
  const existing = await getCloudSavedSongByTitle(normalizedSong.title);
  if (existing && !overwrite) {
    throw new Error("같은 제목의 곡이 이미 보관함에 있습니다.");
  }

  const supabase = getSupabaseBrowserClient();
  const now = new Date().toISOString();
  const savedSongId = existing?.id;
  const cloudSong = {
    ...normalizedSong,
    id: existing?.song.id ?? normalizedSong.id ?? createId("library-song"),
  };
  const payload = {
    user_id: user.id,
    title: cloudSong.title,
    description: cloudSong.description || null,
    youtube_url: cloudSong.youtubeUrl || null,
    youtube_video_id: cloudSong.youtubeVideoId || null,
    original_key: cloudSong.originalKey || null,
    practice_key: cloudSong.practiceKey || null,
    bpm: typeof cloudSong.bpm === "number" ? cloudSong.bpm : null,
    song_data: cloudSong,
    updated_at: now,
  };
  const query = savedSongId
    ? supabase.from("saved_songs").update(payload).eq("id", savedSongId).select("*")
    : supabase.from("saved_songs").insert(payload).select("*");
  const { data, error } = await query.single<SavedSongRow>();

  if (error) {
    throw new Error(error.message || "곡을 보관함에 저장하지 못했습니다.");
  }

  return rowToSavedSong(data);
}

export async function deleteCloudSongFromLibrary(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("saved_songs").delete().eq("id", id);

  if (error) {
    throw new Error(error.message || "곡을 보관함에서 삭제하지 못했습니다.");
  }
}

export async function createCloudSavedSong(input: Partial<Song> & { title: string }) {
  const song: Song = {
    id: input.id ?? createId("song"),
    title: input.title,
    description: input.description ?? "",
    transitionNote: input.transitionNote ?? "",
    youtubeUrl: input.youtubeUrl ?? "",
    youtubeVideoId: input.youtubeVideoId ?? extractYouTubeVideoId(input.youtubeUrl),
    originalKey: input.originalKey ?? "",
    practiceKey: input.practiceKey ?? "",
    bpm: input.bpm,
    sections: input.sections ?? [],
    highlights: input.highlights ?? [],
    partNotes: input.partNotes ?? [],
    links: input.links ?? [],
    capo: input.capo,
    chordForm: input.chordForm ?? "",
    transposeMemo: input.transposeMemo ?? "",
    chordMemo: input.chordMemo ?? "",
    chordProgression: input.chordProgression ?? "",
    sheetLinks: input.sheetLinks ?? [],
  };

  return saveCloudSongToLibrary(song, true);
}

function rowToSavedSong(row: SavedSongRow): SavedSong {
  const songFromJson = row.song_data ?? ({} as Partial<Song>);
  const song: Song = normalizeSong({
    id: songFromJson.id ?? createId("library-song"),
    title: songFromJson.title ?? row.title,
    description: songFromJson.description ?? row.description ?? "",
    transitionNote: songFromJson.transitionNote ?? "",
    youtubeUrl: songFromJson.youtubeUrl ?? row.youtube_url ?? "",
    youtubeVideoId:
      songFromJson.youtubeVideoId ?? row.youtube_video_id ?? extractYouTubeVideoId(songFromJson.youtubeUrl ?? row.youtube_url ?? ""),
    originalKey: songFromJson.originalKey ?? row.original_key ?? "",
    practiceKey: songFromJson.practiceKey ?? row.practice_key ?? "",
    bpm: songFromJson.bpm ?? row.bpm ?? undefined,
    sections: songFromJson.sections ?? [],
    highlights: songFromJson.highlights ?? [],
    partNotes: songFromJson.partNotes ?? [],
    links: songFromJson.links ?? [],
    capo: songFromJson.capo,
    chordForm: songFromJson.chordForm ?? "",
    transposeMemo: songFromJson.transposeMemo ?? "",
    chordMemo: songFromJson.chordMemo ?? "",
    chordProgression: songFromJson.chordProgression ?? "",
    sheetLinks: songFromJson.sheetLinks ?? [],
  });

  return {
    id: row.id,
    song,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeSong(song: Song): Song {
  const youtubeUrl = song.youtubeUrl ?? "";
  return {
    id: song.id || createId("song"),
    title: song.title || "제목 없는 곡",
    description: song.description ?? "",
    transitionNote: song.transitionNote ?? "",
    youtubeUrl,
    youtubeVideoId: song.youtubeVideoId ?? extractYouTubeVideoId(youtubeUrl),
    originalKey: song.originalKey ?? "",
    practiceKey: song.practiceKey ?? "",
    bpm: typeof song.bpm === "number" ? song.bpm : undefined,
    sections: song.sections ?? [],
    highlights: song.highlights ?? [],
    partNotes: song.partNotes ?? [],
    links: song.links ?? [],
    capo: typeof song.capo === "number" ? song.capo : undefined,
    chordForm: song.chordForm ?? "",
    transposeMemo: song.transposeMemo ?? "",
    chordMemo: song.chordMemo ?? "",
    chordProgression: song.chordProgression ?? "",
    sheetLinks: song.sheetLinks ?? [],
  };
}

function normalizeSongTitle(title: string) {
  return title.trim().toLocaleLowerCase("ko-KR");
}
