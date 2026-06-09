"use client";

import { getCurrentUser } from "@/lib/auth";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Setlist, Song } from "@/lib/types";
import { getMyProfile, type Profile } from "./profiles";

const ACTIVE_WINDOW_MS = 2 * 60 * 1000;

export type PracticePresence = {
  id: string;
  userId: string;
  setlistId: string;
  teamId?: string;
  songId: string;
  songTitle: string;
  displayName: string;
  role: string;
  churchName: string;
  praiseTeamName: string;
  lastSeenAt: string;
};

type PracticePresenceRow = {
  id: string;
  user_id: string;
  team_id: string | null;
  setlist_id: string;
  song_id: string;
  song_title: string;
  display_name: string;
  role: string;
  church_name: string;
  praise_team_name: string;
  last_seen_at: string;
};

export async function heartbeatPracticePresence(setlist: Setlist, song: Song) {
  if (!isSupabaseConfigured()) return false;

  const user = await getCurrentUser();
  if (!user) return false;

  const profile = await getMyProfile();
  if (!profile || !canSharePracticePresence(profile, setlist)) {
    await clearMyPracticePresence(setlist.id, song.id).catch(() => undefined);
    return false;
  }

  const now = new Date().toISOString();
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("practice_presence").upsert(
    {
      user_id: user.id,
      team_id: setlist.teamId ?? null,
      setlist_id: setlist.id,
      song_id: song.id,
      song_title: song.title || "제목 없는 곡",
      display_name: profile.displayName || user.email?.split("@")[0] || "팀원",
      role: getPracticeRole(profile, setlist),
      church_name: profile.churchName ?? "",
      praise_team_name: profile.praiseTeamName ?? "",
      last_seen_at: now,
      updated_at: now,
    },
    { onConflict: "user_id,setlist_id,song_id" },
  );

  if (error) {
    throw new Error(error.message || "연습중 상태를 저장하지 못했습니다.");
  }

  return true;
}

export async function getActivePracticePresence(setlistId: string, songId: string) {
  if (!isSupabaseConfigured()) return [];

  const since = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("practice_presence")
    .select("*")
    .eq("setlist_id", setlistId)
    .eq("song_id", songId)
    .gte("last_seen_at", since)
    .order("role", { ascending: true })
    .order("display_name", { ascending: true })
    .returns<PracticePresenceRow[]>();

  if (error) {
    throw new Error(error.message || "연습중인 팀원을 불러오지 못했습니다.");
  }

  return (data ?? []).map(rowToPracticePresence);
}

export async function clearMyPracticePresence(setlistId: string, songId: string) {
  if (!isSupabaseConfigured()) return;

  const user = await getCurrentUser();
  if (!user) return;

  const supabase = getSupabaseBrowserClient();
  await supabase.from("practice_presence").delete().eq("user_id", user.id).eq("setlist_id", setlistId).eq("song_id", songId);
}

function canSharePracticePresence(profile: Profile, setlist: Setlist) {
  if (!profile.sharePracticePresence) return false;
  if (setlist.teamId) return true;
  return Boolean(profile.churchName?.trim() && profile.praiseTeamName?.trim());
}

function getPracticeRole(profile: Profile, setlist: Setlist) {
  const matchedAssignment = setlist.teamAssignments.find(
    (assignment) => normalizeName(assignment.name) === normalizeName(profile.displayName),
  );
  if (matchedAssignment?.part) return matchedAssignment.part;
  if (profile.role === "기타" && profile.customRole) return profile.customRole;
  return profile.role || "팀원";
}

function rowToPracticePresence(row: PracticePresenceRow): PracticePresence {
  return {
    id: row.id,
    userId: row.user_id,
    teamId: row.team_id ?? undefined,
    setlistId: row.setlist_id,
    songId: row.song_id,
    songTitle: row.song_title,
    displayName: row.display_name,
    role: row.role,
    churchName: row.church_name,
    praiseTeamName: row.praise_team_name,
    lastSeenAt: row.last_seen_at,
  };
}

function normalizeName(name?: string) {
  return (name ?? "").trim().replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
}
