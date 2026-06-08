import { groupTeamAssignments } from "@/lib/teamAssignments";
import { formatMemberNameWithEmoji } from "@/lib/roleEmoji";
import type { TeamAssignment } from "@/lib/types";

export function TeamAssignmentsView({ assignments }: { assignments: TeamAssignment[] }) {
  const groups = groupTeamAssignments(assignments);

  if (groups.length === 0) return null;

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="section-title">팀원 파트</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map(({ part, members }) => (
          <div key={part} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-black text-blue-700">{part}</p>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-900">
              {members.map((member) => formatMemberNameWithEmoji(part, member.name)).join(", ")}
            </p>
            {members.some((member) => member.note) ? (
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {members
                  .filter((member) => member.note)
                  .map((member) => `${formatMemberNameWithEmoji(part, member.name)}: ${member.note}`)
                  .join(" / ")}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
