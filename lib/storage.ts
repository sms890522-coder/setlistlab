"use client";

import { createSampleSetlist } from "./sampleData";
import type { PartNote, Setlist, Song, SongSection } from "./types";
import { extractYouTubeVideoId } from "./youtube";

const STORAGE_KEY = "conti-practice-room:setlists";
const INITIALIZED_KEY = "conti-practice-room:initialized";

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

  return setlists.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
    youtubeUrl,
    youtubeVideoId: optionalString(value.youtubeVideoId) ?? extractYouTubeVideoId(youtubeUrl),
    originalKey: optionalString(value.originalKey),
    practiceKey: optionalString(value.practiceKey),
    bpm: typeof value.bpm === "number" && Number.isFinite(value.bpm) ? value.bpm : undefined,
    sections: Array.isArray(value.sections) ? value.sections.map(normalizeSection) : [],
    highlights: Array.isArray(value.highlights) ? value.highlights.filter(isString) : [],
    partNotes: Array.isArray(value.partNotes) ? value.partNotes.map(normalizePartNote) : [],
    links: Array.isArray(value.links)
      ? value.links.filter(isRecord).map((link) => ({
          id: typeof link.id === "string" ? link.id : "",
          label: typeof link.label === "string" ? link.label : "",
          url: typeof link.url === "string" ? link.url : "",
        }))
      : [],
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
