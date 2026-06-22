import type { TeamMembership } from "@/lib/db/teamMemberships";

type TeamRoleLike = Pick<TeamMembership, "role" | "status"> | null | undefined;

function isApproved(membership: TeamRoleLike) {
  return membership?.status === "approved";
}

export function isTeamOwner(membership: TeamRoleLike) {
  return isApproved(membership) && membership?.role === "owner";
}

export function isTeamAdmin(membership: TeamRoleLike) {
  return isApproved(membership) && membership?.role === "admin";
}

export function isTeamLeader(membership: TeamRoleLike) {
  return isTeamOwner(membership);
}

export function canManageTeam(membership: TeamRoleLike) {
  return isTeamOwner(membership);
}

export function canManageMembers(membership: TeamRoleLike) {
  return isTeamOwner(membership);
}

export function canManageDeputyLeaders(membership: TeamRoleLike) {
  return isTeamOwner(membership);
}

export function canTransferLeadership(membership: TeamRoleLike) {
  return isTeamOwner(membership);
}

export function canCreateTeamSetlist(membership: TeamRoleLike) {
  return isTeamOwner(membership) || isTeamAdmin(membership);
}

export function canManageTeamSetlist(membership: TeamRoleLike) {
  return isTeamOwner(membership) || isTeamAdmin(membership);
}

export function canCreateTeamPost(membership: TeamRoleLike) {
  return isTeamOwner(membership) || isTeamAdmin(membership);
}

export function canManageTeamPost(membership: TeamRoleLike) {
  return isTeamOwner(membership) || isTeamAdmin(membership);
}

export function canDeleteTeamPost(membership: TeamRoleLike) {
  return isTeamOwner(membership);
}

export function canCreateTeamCalendarEvent(membership: TeamRoleLike) {
  return isTeamOwner(membership) || isTeamAdmin(membership);
}

export function canManageTeamCalendarEvent(membership: TeamRoleLike) {
  return isTeamOwner(membership) || isTeamAdmin(membership);
}

export function canDeleteTeamCalendarEvent(membership: TeamRoleLike) {
  return isTeamOwner(membership);
}
