"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Song } from "@/lib/types";

export type WeeklyHomeSetlist = {
  id: string;
  teamId: string;
  teamName: string;
  title: string;
  serviceName: string | null;
  serviceDate: string | null;
  songs: Array<{
    title: string;
    key?: string | null;
    bpm?: number | null;
    sections?: string | null;
  }>;
  canCreateSetlist: boolean;
  href: string;
};

export type WeeklyHomeSetlistResult =
  | { status: "ready"; setlist: WeeklyHomeSetlist }
  | { status: "no_team" }
  | { status: "empty"; teamName: string; teamId: string; canCreateSetlist: boolean };

type MembershipWithTeamRow = {
  team_id: string;
  role: "owner" | "admin" | "member";
  status: "pending" | "approved" | "rejected" | "removed";
  created_at: string;
  teams: {
    id: string;
    church_name: string;
    team_name: string;
  } | null;
};

type HomeSetlistRow = {
  id: string;
  team_id: string | null;
  title: string;
  worship_date: string | null;
  service_name: string | null;
  songs: Song[] | null;
  status: string | null;
  updated_at: string;
};

export async function getWeeklyTeamSetlistForUser(): Promise<WeeklyHomeSetlistResult> {
  const supabase = getSupabaseBrowserClient();
  const { data: memberships, error: membershipError } = await supabase
    .from("team_memberships")
    .select("team_id, role, status, created_at, teams(id, church_name, team_name)")
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .returns<MembershipWithTeamRow[]>();

  if (membershipError) throw new Error(membershipError.message || "팀 정보를 불러오지 못했습니다.");

  const membership = pickPrimaryMembership(memberships ?? []);
  if (!membership) return { status: "no_team" };

  const teamName = formatTeamName(membership.teams);
  const canCreateSetlist = membership.role === "owner" || membership.role === "admin";
  const { today, thisSunday, fallbackEnd } = getHomeSetlistDateWindow();
  const rows = await fetchTeamSetlists(membership.team_id, today, fallbackEnd);
  const upcoming = pickUpcomingSetlist(rows, today, thisSunday) ?? pickUpcomingSetlist(rows, today, fallbackEnd);

  if (!upcoming) {
    return {
      status: "empty",
      teamId: membership.team_id,
      teamName,
      canCreateSetlist,
    };
  }

  return {
    status: "ready",
    setlist: {
      id: upcoming.id,
      teamId: membership.team_id,
      teamName,
      title: upcoming.title || "제목 없는 콘티",
      serviceName: upcoming.service_name,
      serviceDate: upcoming.worship_date,
      songs: (upcoming.songs ?? []).slice(0, 5).map((song) => ({
        title: song.title || "제목 없는 곡",
        key: song.practiceKey || song.originalKey || null,
        bpm: song.bpm ?? null,
        sections: song.sections.map((section) => section.name).filter(Boolean).slice(0, 3).join(" - ") || null,
      })),
      canCreateSetlist,
      href: `/setlists/${upcoming.id}`,
    },
  };
}

function pickPrimaryMembership(memberships: MembershipWithTeamRow[]) {
  return [...memberships]
    .filter((membership) => membership.status === "approved")
    .sort((a, b) => {
      const roleScoreA = a.role === "owner" ? 0 : 1;
      const roleScoreB = b.role === "owner" ? 0 : 1;
      if (roleScoreA !== roleScoreB) return roleScoreA - roleScoreB;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    })[0] ?? null;
}

async function fetchTeamSetlists(teamId: string, startDate: string, endDate: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("setlists")
    .select("id, team_id, title, worship_date, service_name, songs, status, updated_at")
    .eq("team_id", teamId)
    .gte("worship_date", startDate)
    .lte("worship_date", endDate)
    .order("worship_date", { ascending: true })
    .order("updated_at", { ascending: false })
    .returns<HomeSetlistRow[]>();

  if (error) throw new Error(error.message || "이번 주 콘티를 불러오지 못했습니다.");
  return data ?? [];
}

function pickUpcomingSetlist(rows: HomeSetlistRow[], startDate: string, endDate: string) {
  return rows
    .filter((row) => row.team_id && row.worship_date && row.worship_date >= startDate && row.worship_date <= endDate)
    .sort((a, b) => {
      const dateCompare = String(a.worship_date).localeCompare(String(b.worship_date));
      if (dateCompare !== 0) return dateCompare;
      const statusScoreA = a.status === "published" ? 0 : 1;
      const statusScoreB = b.status === "published" ? 0 : 1;
      if (statusScoreA !== statusScoreB) return statusScoreA - statusScoreB;
      return b.updated_at.localeCompare(a.updated_at);
    })[0] ?? null;
}

function getHomeSetlistDateWindow() {
  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = todayDate.getDay();
  const daysUntilSunday = (7 - day) % 7;
  const sundayDate = addDays(todayDate, daysUntilSunday);
  const fallbackDate = addDays(todayDate, 14);

  return {
    today: formatDate(todayDate),
    thisSunday: formatDate(sundayDate),
    fallbackEnd: formatDate(fallbackDate),
  };
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTeamName(team: MembershipWithTeamRow["teams"]) {
  if (!team) return "내 팀";
  return [team.church_name, team.team_name].filter(Boolean).join(" · ") || "내 팀";
}
