"use client";

import { getCurrentUser } from "@/lib/auth";
import { normalizeInviteCode } from "@/lib/inviteCode";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { createTeamInviteApprovedNotification } from "./notifications";
import { getTeamsByIds, type Team } from "./teams";
import { getProfile, type Profile } from "./profiles";
import { dispatchPushEvent } from "./pushEvents";

export type TeamMembershipStatus = "pending" | "approved" | "rejected" | "removed";
export type TeamMembershipRole = "owner" | "admin" | "member";

export type TeamMembership = {
  id: string;
  teamId: string;
  userId: string;
  role: TeamMembershipRole;
  position?: string;
  status: TeamMembershipStatus;
  requestedMessage?: string;
  approvedAt?: string;
  rejectedAt?: string;
  removedAt?: string;
  createdAt: string;
  updatedAt: string;
  team?: Team;
  profile?: Profile | null;
};

type TeamMembershipRow = {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamMembershipRole;
  position: string | null;
  status: TeamMembershipStatus;
  requested_message: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  removed_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function requestJoinTeam(inviteCode: string, requestedMessage?: string, position?: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .rpc("request_join_team", {
      p_invite_code: normalizeInviteCode(inviteCode),
      p_requested_message: requestedMessage?.trim() || null,
      p_position: position?.trim() || null,
    })
    .single<TeamMembershipRow>();

  if (error) throw new Error(error.message || "팀 참여 요청을 보내지 못했습니다.");
  void dispatchPushEvent({ eventType: "team_invite_requested", membershipId: data.id });
  return rowToMembership(data);
}

export async function getMyMemberships() {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_memberships")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .returns<TeamMembershipRow[]>();

  if (error) throw new Error(error.message || "내 팀 목록을 불러오지 못했습니다.");

  const memberships = (data ?? []).map(rowToMembership);
  return attachTeams(memberships);
}

export async function getApprovedMemberships() {
  const memberships = await getMyMemberships();
  return memberships.filter((membership) => membership.status === "approved");
}

export async function getTeamMembers(teamId: string) {
  const rows = await getMembershipRows(teamId, "approved");
  return attachProfiles(rows.map(rowToMembership));
}

export async function getPendingJoinRequests(teamId: string) {
  const rows = await getMembershipRows(teamId, "pending");
  return attachProfiles(rows.map(rowToMembership));
}

export async function approveJoinRequest(membershipId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_memberships")
    .update({
      status: "approved",
      role: "member",
      approved_at: new Date().toISOString(),
      rejected_at: null,
      removed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", membershipId)
    .select("*")
    .single<TeamMembershipRow>();

  if (error) throw new Error(error.message || "팀원으로 승인하지 못했습니다.");
  await createTeamInviteApprovedNotification(data.id).catch(() => undefined);
  void dispatchPushEvent({ eventType: "team_invite_approved", membershipId: data.id });
  return rowToMembership(data);
}

export async function rejectJoinRequest(membershipId: string) {
  return updateMembershipStatus(membershipId, "rejected", { rejected_at: new Date().toISOString() });
}

export async function removeTeamMember(membershipId: string) {
  return updateMembershipStatus(membershipId, "removed", { removed_at: new Date().toISOString() });
}

export async function leaveTeam(teamId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("team_memberships")
    .update({ status: "removed", removed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("team_id", teamId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message || "팀에서 나가지 못했습니다.");
}

export async function getMyRoleInTeam(teamId: string) {
  const memberships = await getMyMemberships();
  return memberships.find((membership) => membership.teamId === teamId) ?? null;
}

export async function isApprovedTeamMember(teamId: string) {
  const membership = await getMyRoleInTeam(teamId);
  return membership?.status === "approved";
}

async function getMembershipRows(teamId: string, status: TeamMembershipStatus) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_memberships")
    .select("*")
    .eq("team_id", teamId)
    .eq("status", status)
    .order("role", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<TeamMembershipRow[]>();

  if (error) throw new Error(error.message || "팀원 정보를 불러오지 못했습니다.");
  return data ?? [];
}

async function updateMembershipStatus(membershipId: string, status: TeamMembershipStatus, dates: Record<string, string>) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("team_memberships")
    .update({ status, ...dates, updated_at: new Date().toISOString() })
    .eq("id", membershipId)
    .select("*")
    .single<TeamMembershipRow>();

  if (error) throw new Error(error.message || "팀원 상태를 변경하지 못했습니다.");
  return rowToMembership(data);
}

async function attachTeams(memberships: TeamMembership[]) {
  const teamIds = Array.from(new Set(memberships.map((membership) => membership.teamId)));
  const teams = await getTeamsByIds(teamIds);
  const teamById = new Map(teams.map((team) => [team.id, team]));
  return memberships.map((membership) => ({ ...membership, team: teamById.get(membership.teamId) }));
}

async function attachProfiles(memberships: TeamMembership[]) {
  const results = await Promise.all(
    memberships.map(async (membership) => ({
      ...membership,
      profile: await getProfile(membership.userId).catch(() => null),
    })),
  );
  return results;
}

function rowToMembership(row: TeamMembershipRow): TeamMembership {
  return {
    id: row.id,
    teamId: row.team_id,
    userId: row.user_id,
    role: row.role,
    position: row.position ?? undefined,
    status: row.status,
    requestedMessage: row.requested_message ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    rejectedAt: row.rejected_at ?? undefined,
    removedAt: row.removed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
