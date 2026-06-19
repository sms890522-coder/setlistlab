"use client";

import { getCurrentUser } from "@/lib/auth";
import { cloneSetlist } from "@/lib/factories";
import { createId } from "@/lib/id";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Setlist, SetlistStatus, Song, TeamAssignment } from "@/lib/types";
import { extractYouTubeVideoId } from "@/lib/youtube";
import { getAssignmentsForSetlists, getSetlistAssignments, replaceSetlistAssignments } from "./assignments";
import { createTeamSetlistCreatedNotifications } from "./notifications";
import { dispatchPushEvent } from "./pushEvents";

export type CloudSetlist = Setlist & {
  ownerId?: string;
  isPublic?: boolean;
  shareSlug?: string;
};

type SetlistRow = {
  id: string;
  user_id: string;
  team_id: string | null;
  title: string;
  worship_date: string | null;
  service_name: string | null;
  description: string | null;
  global_notes: string | null;
  songs: Song[] | null;
  status: SetlistStatus | null;
  published_at: string | null;
  notification_sent_at: string | null;
  is_public: boolean;
  share_slug: string | null;
  created_at: string;
  updated_at: string;
};

export async function getCloudSetlists() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("setlists")
    .select("*")
    .order("updated_at", { ascending: false })
    .returns<SetlistRow[]>();

  if (error) {
    throw new Error(error.message || "콘티 목록을 불러오지 못했습니다.");
  }

  const rows = data ?? [];
  const assignmentsBySetlist = await getAssignmentsForSetlists(rows.map((row) => row.id));
  return rows.map((row) => rowToSetlist(row, assignmentsBySetlist.get(row.id) ?? []));
}

export async function getCloudSetlist(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("setlists").select("*").eq("id", id).maybeSingle<SetlistRow>();

  if (error) {
    throw new Error(error.message || "콘티를 불러오지 못했습니다.");
  }

  if (!data) return null;
  const assignments = await getSetlistAssignments(data.id);
  return rowToSetlist(data, assignments);
}

export async function createCloudSetlist(setlist: Setlist) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  const supabase = getSupabaseBrowserClient();
  const normalized = normalizeSetlistForCloud(setlist);
  const { data, error } = await supabase
    .from("setlists")
    .insert({
      user_id: user.id,
      team_id: normalized.teamId || null,
      title: normalized.title,
      worship_date: normalized.worshipDate || null,
      service_name: normalized.serviceName || null,
      description: normalized.description || null,
      global_notes: normalized.globalNotes || null,
      songs: normalized.songs,
      status: "draft",
      published_at: null,
      notification_sent_at: null,
      is_public: false,
    })
    .select("*")
    .single<SetlistRow>();

  if (error) {
    throw new Error(error.message || "콘티를 만들지 못했습니다.");
  }

  const assignments = await replaceSetlistAssignments(data.id, normalized.teamAssignments);
  return rowToSetlist(data, assignments);
}

export async function saveCloudSetlist(setlist: Setlist) {
  if (!isUuid(setlist.id)) {
    return createCloudSetlist(setlist);
  }

  const normalized = normalizeSetlistForCloud(setlist);
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("setlists")
    .update({
      title: normalized.title,
      team_id: normalized.teamId || null,
      worship_date: normalized.worshipDate || null,
      service_name: normalized.serviceName || null,
      description: normalized.description || null,
      global_notes: normalized.globalNotes || null,
      songs: normalized.songs,
      updated_at: new Date().toISOString(),
    })
    .eq("id", normalized.id)
    .select("*")
    .single<SetlistRow>();

  if (error) {
    throw new Error(error.message || "콘티를 저장하지 못했습니다.");
  }

  const assignments = await replaceSetlistAssignments(data.id, normalized.teamAssignments);
  return rowToSetlist(data, assignments);
}

export async function publishCloudSetlist(setlist: Setlist) {
  const saved = await saveCloudSetlist(setlist);
  const supabase = getSupabaseBrowserClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("setlists")
    .update({
      status: "published",
      published_at: saved.publishedAt ?? now,
      updated_at: now,
    })
    .eq("id", saved.id)
    .select("*")
    .single<SetlistRow>();

  if (error) {
    throw new Error(error.message || "콘티를 저장하지 못했습니다.");
  }

  const assignments = await getSetlistAssignments(data.id);
  let published = rowToSetlist(data, assignments);

  if (published.teamId && !published.notificationSentAt) {
    const notified = await createTeamSetlistCreatedNotifications(published.id).catch(() => false);
    if (notified) {
      void dispatchPushEvent({ eventType: "team_setlist_created", setlistId: published.id });
      published = (await getCloudSetlist(published.id)) ?? published;
    }
  }

  return published;
}

export async function deleteCloudSetlist(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("setlists").delete().eq("id", id);

  if (error) {
    throw new Error(error.message || "콘티를 삭제하지 못했습니다.");
  }
}

export async function duplicateCloudSetlist(id: string) {
  const source = await getCloudSetlist(id);
  if (!source) {
    throw new Error("복제할 콘티를 찾을 수 없습니다.");
  }

  return createCloudSetlist(cloneSetlist(source));
}

export async function importLocalSetlistsToCloud(setlists: Setlist[]) {
  const imported: CloudSetlist[] = [];
  for (const setlist of setlists) {
    imported.push(await createCloudSetlist(setlist));
  }
  return imported;
}

export async function setCloudSetlistPublic(id: string, isPublic: boolean) {
  const source = await getCloudSetlist(id);
  if (!source) {
    throw new Error("공유할 콘티를 찾을 수 없습니다.");
  }

  const supabase = getSupabaseBrowserClient();
  const shareSlug = isPublic ? source.shareSlug ?? createShareSlug() : source.shareSlug ?? null;
  const { data, error } = await supabase
    .from("setlists")
    .update({
      is_public: isPublic,
      share_slug: shareSlug,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single<SetlistRow>();

  if (error) {
    throw new Error(error.message || "공유 설정을 저장하지 못했습니다.");
  }

  const assignments = await getSetlistAssignments(id);
  return rowToSetlist(data, assignments);
}

export async function getPublicSetlistBySlug(shareSlug: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("setlists")
    .select("*")
    .eq("share_slug", shareSlug)
    .eq("is_public", true)
    .maybeSingle<SetlistRow>();

  if (error) {
    throw new Error(error.message || "공유 콘티를 불러오지 못했습니다.");
  }

  if (!data) return null;
  const assignments = await getSetlistAssignments(data.id);
  return rowToSetlist(data, assignments);
}

function rowToSetlist(row: SetlistRow, teamAssignments: TeamAssignment[] = []): CloudSetlist {
  return {
    id: row.id,
    teamId: row.team_id ?? undefined,
    status: normalizeSetlistStatus(row.status),
    publishedAt: row.published_at ?? undefined,
    notificationSentAt: row.notification_sent_at ?? undefined,
    title: row.title,
    worshipDate: row.worship_date ?? "",
    serviceName: row.service_name ?? "",
    description: row.description ?? "",
    globalNotes: row.global_notes ?? "",
    songs: Array.isArray(row.songs) ? row.songs.map(normalizeSongForCloud) : [],
    teamAssignments,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ownerId: row.user_id,
    isPublic: row.is_public,
    shareSlug: row.share_slug ?? undefined,
  };
}

function normalizeSetlistForCloud(setlist: Setlist): Setlist {
  const now = new Date().toISOString();
  return {
    ...setlist,
    status: normalizeSetlistStatus(setlist.status),
    publishedAt: setlist.publishedAt,
    notificationSentAt: setlist.notificationSentAt,
    title: setlist.title ?? "",
    teamId: setlist.teamId || undefined,
    worshipDate: setlist.worshipDate ?? "",
    serviceName: setlist.serviceName ?? "",
    description: setlist.description ?? "",
    globalNotes: setlist.globalNotes ?? "",
    songs: (setlist.songs ?? []).map(normalizeSongForCloud),
    teamAssignments: setlist.teamAssignments ?? [],
    createdAt: setlist.createdAt || now,
    updatedAt: now,
  };
}

function normalizeSetlistStatus(status?: SetlistStatus | null): SetlistStatus {
  return status === "published" ? "published" : "draft";
}

function normalizeSongForCloud(song: Song): Song {
  const youtubeUrl = song.youtubeUrl ?? "";
  return {
    id: song.id || createId("song"),
    title: song.title ?? "",
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
    imageLinks: song.imageLinks ?? [],
  };
}

function createShareSlug() {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const bytes = new Uint8Array(9);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 16);
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
