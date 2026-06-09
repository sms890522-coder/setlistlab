"use client";

import { getCurrentUser } from "@/lib/auth";
import { generateInviteCode, normalizeInviteCode } from "@/lib/inviteCode";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type Team = {
  id: string;
  ownerId: string;
  churchName: string;
  teamName: string;
  description?: string;
  inviteCode: string;
  inviteEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InviteTeamPreview = {
  id: string;
  churchName: string;
  teamName: string;
  description?: string;
  inviteEnabled: boolean;
  myStatus?: string;
};

type TeamRow = {
  id: string;
  owner_id: string;
  church_name: string;
  team_name: string;
  description: string | null;
  invite_code: string;
  invite_enabled: boolean;
  created_at: string;
  updated_at: string;
};

type InviteTeamPreviewRow = {
  id: string;
  church_name: string;
  team_name: string;
  description: string | null;
  invite_enabled: boolean;
  my_status: string | null;
};

export async function createTeam(input: { churchName: string; teamName: string; description?: string }) {
  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const supabase = getSupabaseBrowserClient();
  const basePayload = {
    owner_id: user.id,
    church_name: input.churchName.trim(),
    team_name: input.teamName.trim(),
    description: input.description?.trim() || null,
  };

  if (!basePayload.church_name) throw new Error("교회 이름을 입력해 주세요.");
  if (!basePayload.team_name) throw new Error("찬양팀 이름을 입력해 주세요.");

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const inviteCode = generateInviteCode();
    const { data, error } = await supabase
      .from("teams")
      .insert({ ...basePayload, invite_code: inviteCode })
      .select("*")
      .single<TeamRow>();

    if (error) {
      if (isDuplicateInviteError(error.message)) continue;
      throw new Error(error.message || "팀을 만들지 못했습니다.");
    }

    const team = rowToTeam(data);
    const { error: membershipError } = await supabase.from("team_memberships").insert({
      team_id: team.id,
      user_id: user.id,
      role: "owner",
      position: "찬양인도자",
      status: "approved",
      approved_at: new Date().toISOString(),
    });
    if (membershipError) {
      throw new Error(membershipError.message || "팀장 권한을 등록하지 못했습니다.");
    }

    return team;
  }

  throw new Error("초대코드를 만들지 못했습니다. 다시 시도해 주세요.");
}

export async function getTeam(teamId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("teams").select("*").eq("id", teamId).maybeSingle<TeamRow>();

  if (error) throw new Error(error.message || "팀 정보를 불러오지 못했습니다.");
  return data ? rowToTeam(data) : null;
}

export async function getTeamsByIds(teamIds: string[]) {
  if (teamIds.length === 0) return [];

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("teams").select("*").in("id", teamIds).returns<TeamRow[]>();

  if (error) throw new Error(error.message || "팀 목록을 불러오지 못했습니다.");
  return (data ?? []).map(rowToTeam);
}

export async function updateTeam(teamId: string, input: { churchName?: string; teamName?: string; description?: string }) {
  const supabase = getSupabaseBrowserClient();
  const payload = {
    ...(input.churchName !== undefined ? { church_name: input.churchName.trim() } : {}),
    ...(input.teamName !== undefined ? { team_name: input.teamName.trim() } : {}),
    ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("teams").update(payload).eq("id", teamId).select("*").single<TeamRow>();
  if (error) throw new Error(error.message || "팀 정보를 저장하지 못했습니다.");
  return rowToTeam(data);
}

export async function regenerateInviteCode(teamId: string) {
  const supabase = getSupabaseBrowserClient();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const inviteCode = generateInviteCode();
    const { data, error } = await supabase
      .from("teams")
      .update({ invite_code: inviteCode, invite_enabled: true, updated_at: new Date().toISOString() })
      .eq("id", teamId)
      .select("*")
      .single<TeamRow>();

    if (error) {
      if (isDuplicateInviteError(error.message)) continue;
      throw new Error(error.message || "초대코드를 재발급하지 못했습니다.");
    }

    return rowToTeam(data);
  }

  throw new Error("초대코드를 재발급하지 못했습니다. 다시 시도해 주세요.");
}

export async function disableInviteCode(teamId: string) {
  return setInviteEnabled(teamId, false);
}

export async function enableInviteCode(teamId: string) {
  return setInviteEnabled(teamId, true);
}

export async function findTeamByInviteCode(inviteCode: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .rpc("find_team_by_invite_code", { p_invite_code: normalizeInviteCode(inviteCode) })
    .returns<InviteTeamPreviewRow[]>();

  if (error) throw new Error(error.message || "초대코드를 찾을 수 없습니다.");
  const rows = data as InviteTeamPreviewRow[] | null;
  const row = rows?.[0];
  return row ? rowToInvitePreview(row) : null;
}

async function setInviteEnabled(teamId: string, inviteEnabled: boolean) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("teams")
    .update({ invite_enabled: inviteEnabled, updated_at: new Date().toISOString() })
    .eq("id", teamId)
    .select("*")
    .single<TeamRow>();

  if (error) throw new Error(error.message || "초대코드 설정을 바꾸지 못했습니다.");
  return rowToTeam(data);
}

function rowToTeam(row: TeamRow): Team {
  return {
    id: row.id,
    ownerId: row.owner_id,
    churchName: row.church_name,
    teamName: row.team_name,
    description: row.description ?? undefined,
    inviteCode: row.invite_code,
    inviteEnabled: row.invite_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToInvitePreview(row: InviteTeamPreviewRow): InviteTeamPreview {
  return {
    id: row.id,
    churchName: row.church_name,
    teamName: row.team_name,
    description: row.description ?? undefined,
    inviteEnabled: row.invite_enabled,
    myStatus: row.my_status ?? undefined,
  };
}

function isDuplicateInviteError(message?: string) {
  return Boolean(message?.toLowerCase().includes("duplicate") || message?.toLowerCase().includes("unique"));
}
