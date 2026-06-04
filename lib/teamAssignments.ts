import { DEFAULT_TEAM_PARTS, type TeamAssignment } from "./types";

export function sortTeamAssignments(assignments: TeamAssignment[]) {
  return [...assignments].sort((a, b) => {
    const partDifference = getPartOrder(a.part) - getPartOrder(b.part);
    return partDifference || a.name.localeCompare(b.name, "ko-KR");
  });
}

export function groupTeamAssignments(assignments: TeamAssignment[]) {
  const groups = new Map<string, TeamAssignment[]>();
  sortTeamAssignments(assignments).forEach((assignment) => {
    const part = assignment.part.trim() || "기타";
    groups.set(part, [...(groups.get(part) ?? []), assignment]);
  });
  return Array.from(groups.entries()).map(([part, members]) => ({ part, members }));
}

function getPartOrder(part: string) {
  const index = DEFAULT_TEAM_PARTS.indexOf(part as (typeof DEFAULT_TEAM_PARTS)[number]);
  return index < 0 ? DEFAULT_TEAM_PARTS.length : index;
}
