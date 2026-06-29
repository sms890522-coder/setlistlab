"use client";

import { getCurrentUser } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { SongTag } from "@/lib/types";

const MAX_TAGS_PER_SONG = 20;
const MAX_TAG_LENGTH = 30;

export const DEFAULT_SONG_TAGS = [
  "감사",
  "보혈",
  "성령",
  "하나님",
  "예수님",
  "회개",
  "기쁨",
  "고백",
  "간구",
  "승리",
  "교제",
  "소명",
  "헌신",
  "속죄",
  "구원",
  "신뢰",
  "믿음",
  "은혜",
  "사랑",
  "인도",
  "전도",
  "선교",
  "동행",
  "찬양",
  "경배",
  "영접",
  "축복",
  "평안",
  "통치",
  "선포",
  "하나님나라",
] as const;

export const LEGACY_RECOMMENDED_SONG_TAGS = [
  "빠른곡",
  "느린곡",
  "헌금송",
  "기도회",
  "청년부",
  "성탄절",
  "부활절",
  "쉬운곡",
  "마무리곡",
] as const;

export const RECOMMENDED_SONG_TAGS = [
  ...DEFAULT_SONG_TAGS,
  ...LEGACY_RECOMMENDED_SONG_TAGS,
] as const;

type SongTagRow = {
  id: string;
  user_id: string;
  song_id: string;
  name: string;
  normalized_name: string;
  created_at: string;
};

export function normalizeTagName(name: string): string {
  return cleanTagName(name).toLocaleLowerCase("ko-KR");
}

export function normalizeSongTagName(value: string): string {
  return normalizeTagName(value);
}

export function dedupeSongTags(tags: string[]): string[] {
  const normalizedTags = new Map<string, string>();
  for (const tag of tags) {
    const cleaned = cleanTagName(tag);
    if (!cleaned) continue;
    const normalized = normalizeTagName(cleaned);
    if (!normalized || normalizedTags.has(normalized)) continue;
    normalizedTags.set(normalized, cleaned);
  }
  return Array.from(normalizedTags.values());
}

export function cleanTagName(name: string): string {
  return name
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getSongTags(songId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("song_tags")
    .select("*")
    .eq("song_id", songId)
    .order("created_at", { ascending: true })
    .returns<SongTagRow[]>();

  if (error) throw new Error(error.message || "곡 태그를 불러오지 못했습니다.");
  return (data ?? []).map(rowToSongTag);
}

export async function getSongTagsForSongs(songIds: string[]) {
  const uniqueSongIds = Array.from(new Set(songIds)).filter(Boolean);
  const tagsBySong = new Map<string, SongTag[]>();
  for (const songId of uniqueSongIds) tagsBySong.set(songId, []);
  if (uniqueSongIds.length === 0) return tagsBySong;

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("song_tags")
    .select("*")
    .in("song_id", uniqueSongIds)
    .order("created_at", { ascending: true })
    .returns<SongTagRow[]>();

  if (error) throw new Error(error.message || "곡 태그를 불러오지 못했습니다.");

  for (const row of data ?? []) {
    const tag = rowToSongTag(row);
    tagsBySong.set(tag.songId, [...(tagsBySong.get(tag.songId) ?? []), tag]);
  }
  return tagsBySong;
}

export const getTagsForSongs = getSongTagsForSongs;

export async function getMySongTags() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("song_tags")
    .select("name,normalized_name")
    .order("normalized_name", { ascending: true })
    .returns<Array<{ name: string; normalized_name: string }>>();

  if (error) throw new Error(error.message || "내 태그 목록을 불러오지 못했습니다.");

  const tags = new Map<string, string>();
  for (const row of data ?? []) {
    if (!tags.has(row.normalized_name)) tags.set(row.normalized_name, row.name);
  }
  return Array.from(tags.values()).sort((a, b) => a.localeCompare(b, "ko-KR"));
}

export const getMyUsedSongTags = getMySongTags;

export async function addSongTag(songId: string, name: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const tag = normalizeTagInput(name);
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("song_tags")
    .upsert(
      {
        user_id: user.id,
        song_id: songId,
        name: tag.name,
        normalized_name: tag.normalizedName,
      },
      { onConflict: "user_id,song_id,normalized_name" },
    )
    .select("*")
    .single<SongTagRow>();

  if (error) throw new Error(error.message || "태그를 추가하지 못했습니다.");
  return rowToSongTag(data);
}

export async function removeSongTag(tagId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("song_tags").delete().eq("id", tagId);
  if (error) throw new Error(error.message || "태그를 삭제하지 못했습니다.");
}

export async function updateSongTags(songId: string, tagNames: string[]) {
  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const nextTags = normalizeTagInputs(tagNames);
  const currentTags = await getSongTags(songId);
  const nextNormalized = new Set(nextTags.map((tag) => tag.normalizedName));
  const currentNormalized = new Set(currentTags.map((tag) => tag.normalizedName));
  const tagsToDelete = currentTags.filter((tag) => !nextNormalized.has(tag.normalizedName));
  const tagsToInsert = nextTags.filter((tag) => !currentNormalized.has(tag.normalizedName));
  const tagsToRename = nextTags.filter((tag) => {
    const current = currentTags.find((item) => item.normalizedName === tag.normalizedName);
    return current && current.name !== tag.name;
  });

  await Promise.all(tagsToDelete.map((tag) => removeSongTag(tag.id)));

  if (tagsToRename.length > 0) {
    const supabase = getSupabaseBrowserClient();
    await Promise.all(
      tagsToRename.map(async (tag) => {
        const { error } = await supabase
          .from("song_tags")
          .update({ name: tag.name })
          .eq("song_id", songId)
          .eq("normalized_name", tag.normalizedName);
        if (error) throw new Error(error.message || "태그를 수정하지 못했습니다.");
      }),
    );
  }

  if (tagsToInsert.length > 0) {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("song_tags").insert(
      tagsToInsert.map((tag) => ({
        user_id: user.id,
        song_id: songId,
        name: tag.name,
        normalized_name: tag.normalizedName,
      })),
    );
    if (error) throw new Error(error.message || "태그를 저장하지 못했습니다.");
  }

  return getSongTags(songId);
}

export async function searchSongsByTags(tagNames: string[], mode: "or" | "and" = "or") {
  const normalizedTags = normalizeTagInputs(tagNames).map((tag) => tag.normalizedName);
  if (normalizedTags.length === 0) return [];

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("song_tags")
    .select("song_id,normalized_name")
    .in("normalized_name", normalizedTags)
    .returns<Array<{ song_id: string; normalized_name: string }>>();

  if (error) throw new Error(error.message || "태그 검색을 하지 못했습니다.");

  const tagsBySong = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const tags = tagsBySong.get(row.song_id) ?? new Set<string>();
    tags.add(row.normalized_name);
    tagsBySong.set(row.song_id, tags);
  }

  return Array.from(tagsBySong.entries())
    .filter(([, tags]) => (mode === "and" ? normalizedTags.every((tag) => tags.has(tag)) : normalizedTags.some((tag) => tags.has(tag))))
    .map(([songId]) => songId);
}

export const getSongsByTags = searchSongsByTags;

export async function getSongsWithTags() {
  const tagNames = await getMySongTags();
  const matchingSongIds = tagNames.length > 0 ? await searchSongsByTags(tagNames) : [];
  return getSongTagsForSongs(matchingSongIds);
}

function normalizeTagInputs(tagNames: string[]) {
  const tags = new Map<string, { name: string; normalizedName: string }>();
  for (const tagName of tagNames) {
    const tag = normalizeTagInput(tagName);
    tags.set(tag.normalizedName, tag);
  }

  const nextTags = Array.from(tags.values());
  if (nextTags.length > MAX_TAGS_PER_SONG) {
    throw new Error(`태그는 곡마다 최대 ${MAX_TAGS_PER_SONG}개까지 추가할 수 있습니다.`);
  }
  return nextTags;
}

function normalizeTagInput(name: string) {
  const cleaned = cleanTagName(name);
  if (!cleaned) throw new Error("태그 이름을 입력해 주세요.");
  if (cleaned.length > MAX_TAG_LENGTH) throw new Error(`태그는 ${MAX_TAG_LENGTH}자까지 입력할 수 있습니다.`);

  const normalizedName = normalizeTagName(cleaned);
  if (!normalizedName) throw new Error("태그 이름을 입력해 주세요.");
  return { name: cleaned, normalizedName };
}

function rowToSongTag(row: SongTagRow): SongTag {
  return {
    id: row.id,
    songId: row.song_id,
    name: row.name,
    normalizedName: row.normalized_name,
    createdAt: row.created_at,
  };
}
