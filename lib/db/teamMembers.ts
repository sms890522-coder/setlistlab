"use client";

import { getCurrentUser } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { TeamAssignment } from "@/lib/types";

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  memo?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type TeamMemberRow = {
  id: string;
  user_id: string;
  name: string;
  role: string;
  memo: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function getTeamMembers() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .eq("is_active", true)
    .order("role", { ascending: true })
    .order("name", { ascending: true })
    .returns<TeamMemberRow[]>();

  if (error) {
    throw new Error(error.message || "팀원 목록을 불러오지 못했습니다.");
  }

  return (data ?? []).map(rowToTeamMember);
}

export async function saveTeamMember(input: {
  id?: string;
  name: string;
  role: string;
  memo?: string;
}) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  const supabase = getSupabaseBrowserClient();
  const payload = {
    user_id: user.id,
    name: input.name.trim(),
    role: input.role.trim(),
    memo: input.memo?.trim() || null,
    is_active: true,
    updated_at: new Date().toISOString(),
  };
  const query = input.id
    ? supabase.from("team_members").update(payload).eq("id", input.id).select("*")
    : supabase.from("team_members").insert(payload).select("*");
  const { data, error } = await query.single<TeamMemberRow>();

  if (error) {
    throw new Error(error.message || "팀원 정보를 저장하지 못했습니다.");
  }

  return rowToTeamMember(data);
}

export async function deleteTeamMember(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("team_members")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "팀원을 삭제하지 못했습니다.");
  }
}

export function teamMemberToAssignment(member: TeamMember): TeamAssignment {
  return {
    id: member.id,
    name: member.name,
    part: member.role,
    note: member.memo,
  };
}

function rowToTeamMember(row: TeamMemberRow): TeamMember {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    memo: row.memo ?? undefined,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
