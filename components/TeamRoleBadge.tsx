import type { TeamMembershipRole } from "@/lib/db/teamMemberships";

type TeamRoleBadgeProps = {
  role: TeamMembershipRole;
  className?: string;
};

export function TeamRoleBadge({ role, className }: TeamRoleBadgeProps) {
  const meta = getTeamRoleMeta(role);
  const classes = [
    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black",
    meta.className,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} title={meta.description}>
      <span aria-hidden="true">{meta.icon}</span>
      {meta.label}
    </span>
  );
}

export function getTeamRoleLabel(role: TeamMembershipRole | string) {
  return getTeamRoleMeta(role as TeamMembershipRole).label;
}

export function getTeamRoleIcon(role: TeamMembershipRole | string) {
  return getTeamRoleMeta(role as TeamMembershipRole).icon;
}

export function getTeamRoleDescription(role: TeamMembershipRole | string) {
  return getTeamRoleMeta(role as TeamMembershipRole).description;
}

function getTeamRoleMeta(role: TeamMembershipRole) {
  if (role === "owner") {
    return {
      icon: "👑",
      label: "리더",
      description: "팀을 관리하고, 팀원 승인과 부리더 지정, 권한 양도를 할 수 있습니다.",
      className: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }

  if (role === "admin") {
    return {
      icon: "♕",
      label: "부리더",
      description: "팀 콘티, 공지사항, 일정을 함께 관리할 수 있습니다.",
      className: "border-slate-300 bg-slate-100 text-slate-700",
    };
  }

  return {
    icon: "",
    label: "팀원",
    description: "콘티와 공지, 일정을 확인하고 팀 채팅에 참여할 수 있습니다.",
    className: "border-blue-100 bg-blue-50 text-blue-700",
  };
}
