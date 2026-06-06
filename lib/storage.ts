"use client";

import { createSampleSetlist, SAMPLE_SETLIST_ID, SAMPLE_YOUTUBE_URLS } from "./sampleData";
import { cloneSetlist } from "./factories";
import { createId } from "./id";
import type { PartNote, SavedSong, Setlist, Song, SongLink, SongSection, TeamAssignment } from "./types";
import { extractYouTubeVideoId } from "./youtube";

const STORAGE_KEY = "conti-practice-room:setlists";
const INITIALIZED_KEY = "conti-practice-room:initialized";
const SONG_LIBRARY_KEY = "conti-practice-room:song-library";
const PRACTICE_COMPLETION_KEY = "conti-practice-room:practice-completion";
const PRACTICE_POSITION_KEY = "conti-practice-room:practice-position";

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readStoredSetlists(): Setlist[] {
  if (!canUseStorage()) return [];

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeSetlist) : [];
  } catch {
    return [];
  }
}

function writeStoredSetlists(setlists: Setlist[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(setlists));
  window.localStorage.setItem(INITIALIZED_KEY, "true");
}

export function getSetlists() {
  if (!canUseStorage()) return [];

  const initialized = window.localStorage.getItem(INITIALIZED_KEY);
  const setlists = readStoredSetlists();

  if (!initialized && setlists.length === 0) {
    const sample = createSampleSetlist();
    writeStoredSetlists([sample]);
    return [sample];
  }

  const { changed, setlists: upgradedSetlists } = upgradeSampleYoutubeLinks(setlists);
  if (changed) {
    writeStoredSetlists(upgradedSetlists);
  }

  return upgradedSetlists.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getSetlist(id: string) {
  return getSetlists().find((setlist) => setlist.id === id);
}

export function saveSetlist(setlist: Setlist) {
  const normalized = normalizeSetlist({
    ...setlist,
    updatedAt: new Date().toISOString(),
  });
  const setlists = readStoredSetlists();
  const nextSetlists = setlists.some((item) => item.id === normalized.id)
    ? setlists.map((item) => (item.id === normalized.id ? normalized : item))
    : [normalized, ...setlists];

  writeStoredSetlists(nextSetlists);
  return normalized;
}

export function deleteSetlist(id: string) {
  const setlists = readStoredSetlists().filter((setlist) => setlist.id !== id);
  writeStoredSetlists(setlists);
}

export function duplicateSetlist(id: string) {
  const source = getSetlist(id);
  if (!source) {
    throw new Error("복제할 콘티를 찾을 수 없습니다.");
  }

  return saveSetlist(cloneSetlist(source));
}

export function getSongLibrary() {
  if (!canUseStorage()) return [];

  const raw = window.localStorage.getItem(SONG_LIBRARY_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map(normalizeSavedSong).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      : [];
  } catch {
    return [];
  }
}

export function getSavedSongByTitle(title: string) {
  const normalizedTitle = normalizeSongTitle(title);
  return getSongLibrary().find((item) => normalizeSongTitle(item.song.title) === normalizedTitle);
}

export function saveSongToLibrary(song: Song, overwrite = false) {
  if (!canUseStorage()) {
    throw new Error("브라우저 저장소를 사용할 수 없습니다.");
  }

  const library = getSongLibrary();
  const normalizedSong = normalizeSong(song);
  const existing = library.find((item) => normalizeSongTitle(item.song.title) === normalizeSongTitle(normalizedSong.title));
  if (existing && !overwrite) {
    throw new Error("같은 제목의 곡이 이미 보관함에 있습니다.");
  }

  const now = new Date().toISOString();
  const savedSong: SavedSong = {
    id: existing?.id ?? createId("saved-song"),
    song: { ...normalizedSong, id: existing?.song.id ?? createId("library-song") },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const nextLibrary = existing
    ? library.map((item) => (item.id === existing.id ? savedSong : item))
    : [savedSong, ...library];

  window.localStorage.setItem(SONG_LIBRARY_KEY, JSON.stringify(nextLibrary));
  return savedSong;
}

export function deleteSongFromLibrary(id: string) {
  if (!canUseStorage()) return;
  const nextLibrary = getSongLibrary().filter((item) => item.id !== id);
  window.localStorage.setItem(SONG_LIBRARY_KEY, JSON.stringify(nextLibrary));
}

export function getPracticeCompletions(setlistId: string) {
  if (!canUseStorage()) return {};

  try {
    const raw = window.localStorage.getItem(PRACTICE_COMPLETION_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!isRecord(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([key, value]) => key.startsWith(`${setlistId}:`) && value === true)
        .map(([key]) => [key.slice(setlistId.length + 1), true]),
    ) as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function getPracticeCompletion(setlistId: string, songId: string) {
  return Boolean(getPracticeCompletions(setlistId)[songId]);
}

export function setPracticeCompletion(setlistId: string, songId: string, completed: boolean) {
  if (!canUseStorage()) return;

  let completions: Record<string, boolean> = {};
  try {
    const raw = window.localStorage.getItem(PRACTICE_COMPLETION_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (isRecord(parsed)) {
      completions = Object.fromEntries(
        Object.entries(parsed).filter(([, value]) => typeof value === "boolean"),
      ) as Record<string, boolean>;
    }
  } catch {
    completions = {};
  }

  const key = `${setlistId}:${songId}`;
  if (completed) {
    completions[key] = true;
  } else {
    delete completions[key];
  }
  window.localStorage.setItem(PRACTICE_COMPLETION_KEY, JSON.stringify(completions));
}

export function getPracticePosition(setlistId: string, songId: string) {
  if (!canUseStorage()) return 0;

  try {
    const raw = window.localStorage.getItem(PRACTICE_POSITION_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!isRecord(parsed)) return 0;

    const value = parsed[`${setlistId}:${songId}`];
    return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
  } catch {
    return 0;
  }
}

export function setPracticePosition(setlistId: string, songId: string, seconds: number) {
  if (!canUseStorage()) return;

  let positions: Record<string, number> = {};
  try {
    const raw = window.localStorage.getItem(PRACTICE_POSITION_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (isRecord(parsed)) {
      positions = Object.fromEntries(
        Object.entries(parsed).filter(([, value]) => typeof value === "number" && Number.isFinite(value)),
      ) as Record<string, number>;
    }
  } catch {
    positions = {};
  }

  const key = `${setlistId}:${songId}`;
  const normalizedSeconds = Math.max(0, Math.round(seconds));
  if (normalizedSeconds < 3) {
    delete positions[key];
  } else {
    positions[key] = normalizedSeconds;
  }

  window.localStorage.setItem(PRACTICE_POSITION_KEY, JSON.stringify(positions));
}

export function importSetlist(setlist: unknown) {
  const normalized = normalizeSetlist(setlist);
  saveSetlist(normalized);
  return normalized;
}

export function exportSetlist(setlist: Setlist) {
  return JSON.stringify(normalizeSetlist(setlist), null, 2);
}

export function parseSetlistJson(json: string) {
  try {
    return normalizeSetlist(JSON.parse(json));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("콘티 JSON 형식이 올바르지 않습니다. JSON 문법을 확인해 주세요.");
    }

    if (error instanceof Error) {
      throw new Error(error.message || "콘티 JSON을 읽을 수 없습니다.");
    }
    throw new Error("콘티 JSON을 읽을 수 없습니다.");
  }
}

function normalizeSetlist(value: unknown): Setlist {
  if (!isRecord(value)) {
    throw new Error("콘티 데이터 형식이 올바르지 않습니다.");
  }

  if (typeof value.id !== "string" || typeof value.title !== "string") {
    throw new Error("콘티 id 또는 제목이 없습니다.");
  }

  const now = new Date().toISOString();
  return {
    id: value.id,
    title: value.title,
    worshipDate: typeof value.worshipDate === "string" ? value.worshipDate : "",
    serviceName: typeof value.serviceName === "string" ? value.serviceName : "",
    description: optionalString(value.description),
    globalNotes: optionalString(value.globalNotes),
    songs: Array.isArray(value.songs) ? value.songs.map(normalizeSong) : [],
    teamAssignments: Array.isArray(value.teamAssignments)
      ? value.teamAssignments.filter(isRecord).map(normalizeTeamAssignment)
      : [],
    createdAt: typeof value.createdAt === "string" ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : now,
  };
}

function normalizeSong(value: unknown): Song {
  if (!isRecord(value)) {
    throw new Error("곡 데이터 형식이 올바르지 않습니다.");
  }

  if (typeof value.id !== "string" || typeof value.title !== "string") {
    throw new Error("곡 id 또는 제목이 없습니다.");
  }

  const youtubeUrl = optionalString(value.youtubeUrl);
  return {
    id: value.id,
    title: value.title,
    description: optionalString(value.description),
    transitionNote: optionalString(value.transitionNote),
    youtubeUrl,
    youtubeVideoId: optionalString(value.youtubeVideoId) ?? extractYouTubeVideoId(youtubeUrl),
    originalKey: optionalString(value.originalKey),
    practiceKey: optionalString(value.practiceKey),
    bpm: typeof value.bpm === "number" && Number.isFinite(value.bpm) ? value.bpm : undefined,
    sections: Array.isArray(value.sections) ? value.sections.map(normalizeSection) : [],
    highlights: Array.isArray(value.highlights) ? value.highlights.filter(isString) : [],
    partNotes: Array.isArray(value.partNotes) ? value.partNotes.map(normalizePartNote) : [],
    links: Array.isArray(value.links) ? value.links.filter(isRecord).map(normalizeSongLink) : [],
    capo: optionalNumber(value.capo),
    chordForm: optionalString(value.chordForm),
    transposeMemo: optionalString(value.transposeMemo),
    chordMemo: optionalString(value.chordMemo),
    chordProgression: optionalString(value.chordProgression),
    sheetLinks: Array.isArray(value.sheetLinks) ? value.sheetLinks.filter(isRecord).map(normalizeSongLink) : [],
  };
}

function normalizeSavedSong(value: unknown): SavedSong {
  if (!isRecord(value) || typeof value.id !== "string") {
    throw new Error("곡 보관함 데이터 형식이 올바르지 않습니다.");
  }

  const now = new Date().toISOString();
  return {
    id: value.id,
    song: normalizeSong(value.song),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : now,
  };
}

function normalizeSection(value: unknown): SongSection {
  if (!isRecord(value)) {
    throw new Error("구간 데이터 형식이 올바르지 않습니다.");
  }

  return {
    id: typeof value.id === "string" ? value.id : "",
    name: typeof value.name === "string" ? value.name : "",
    startTime: optionalNumber(value.startTime),
    endTime: optionalNumber(value.endTime),
    memo: optionalString(value.memo),
  };
}

function normalizePartNote(value: unknown): PartNote {
  if (!isRecord(value)) {
    throw new Error("파트 메모 데이터 형식이 올바르지 않습니다.");
  }

  return {
    id: typeof value.id === "string" ? value.id : "",
    part: typeof value.part === "string" ? value.part : "",
    note: typeof value.note === "string" ? value.note : "",
  };
}

function normalizeSongLink(value: unknown): SongLink {
  if (!isRecord(value)) {
    throw new Error("곡 링크 데이터 형식이 올바르지 않습니다.");
  }

  return {
    id: typeof value.id === "string" ? value.id : createId("link"),
    label: typeof value.label === "string" ? value.label : "",
    url: typeof value.url === "string" ? value.url : "",
  };
}

function normalizeTeamAssignment(value: unknown): TeamAssignment {
  if (!isRecord(value)) {
    throw new Error("팀원 파트 배정 데이터 형식이 올바르지 않습니다.");
  }

  return {
    id: typeof value.id === "string" ? value.id : createId("assignment"),
    name: typeof value.name === "string" ? value.name : "",
    part: typeof value.part === "string" ? value.part : "",
    note: optionalString(value.note),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeSongTitle(title: string) {
  return title.trim().toLocaleLowerCase("ko-KR");
}

function upgradeSampleYoutubeLinks(setlists: Setlist[]) {
  let changed = false;
  const upgradedSetlists = setlists.map((setlist) => {
    if (setlist.id !== SAMPLE_SETLIST_ID) return setlist;

    const songs = setlist.songs.map((song) => {
      const sampleUrl = SAMPLE_YOUTUBE_URLS[song.title];
      if (!sampleUrl || hasCustomYoutubeUrl(song.youtubeUrl)) return song;

      changed = true;
      return {
        ...song,
        youtubeUrl: sampleUrl,
        youtubeVideoId: extractYouTubeVideoId(sampleUrl),
      };
    });

    return { ...setlist, songs };
  });

  return { changed, setlists: upgradedSetlists };
}

function hasCustomYoutubeUrl(url?: string) {
  if (!url) return false;
  return !url.toLowerCase().includes("placeholder");
}
