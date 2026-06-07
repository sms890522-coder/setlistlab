"use client";

import { getCurrentUser } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { TeamAssignment } from "@/lib/types";

type SetlistAssignmentRow = {
  id: string;
  setlist_id: string;
  user_id: string;
  team_member_id: string | null;
  member_name: string;
  role: string;
  memo: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export async function getSetlistAssignments(setlistId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("setlist_assignments")
    .select("*")
    .eq("setlist_id", setlistId)
    .order("sort_order", { ascending: true })
    .returns<SetlistAssignmentRow[]>();

  if (error) {
    throw new Error(error.message || "팀원 파트 배정을 불러오지 못했습니다.");
  }

  return (data ?? []).map(rowToTeamAssignment);
}

export async function getAssignmentsForSetlists(setlistIds: string[]) {
  if (setlistIds.length === 0) return new Map<string, TeamAssignment[]>();

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("setlist_assignments")
    .select("*")
    .in("setlist_id", setlistIds)
    .order("sort_order", { ascending: true })
    .returns<SetlistAssignmentRow[]>();

  if (error) {
    throw new Error(error.message || "팀원 파트 배정을 불러오지 못했습니다.");
  }

  const grouped = new Map<string, TeamAssignment[]>();
  for (const row of data ?? []) {
    const assignments = grouped.get(row.setlist_id) ?? [];
    assignments.push(rowToTeamAssignment(row));
    grouped.set(row.setlist_id, assignments);
  }
  return grouped;
}

export async function replaceSetlistAssignments(setlistId: string, assignments: TeamAssignment[]) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  const supabase = getSupabaseBrowserClient();
  const { error: deleteError } = await supabase.from("setlist_assignments").delete().eq("setlist_id", setlistId);

  if (deleteError) {
    throw new Error(deleteError.message || "기존 팀원 파트 배정을 정리하지 못했습니다.");
  }

  const rows = assignments
    .filter((assignment) => assignment.name.trim() || assignment.part.trim())
    .map((assignment, index) => ({
      setlist_id: setlistId,
      user_id: user.id,
      team_member_id: null,
      member_name: assignment.name.trim(),
      role: assignment.part.trim(),
      memo: assignment.note?.trim() || null,
      sort_order: index,
    }));

  if (rows.length === 0) return [];

  const { data, error } = await supabase.from("setlist_assignments").insert(rows).select("*").returns<SetlistAssignmentRow[]>();

  if (error) {
    throw new Error(error.message || "팀원 파트 배정을 저장하지 못했습니다.");
  }

  return (data ?? []).map(rowToTeamAssignment);
}

function rowToTeamAssignment(row: SetlistAssignmentRow): TeamAssignment {
  return {
    id: row.team_member_id ?? row.id,
    name: row.member_name,
    part: row.role,
    note: row.memo ?? undefined,
  };
}
