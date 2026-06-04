import type { Setlist } from "./types";
import { groupTeamAssignments } from "./teamAssignments";

export function formatSetlistSummary(setlist: Setlist) {
  const lines = [
    `[콘티연습실] ${setlist.title || "제목 없는 콘티"}`,
    `예배 날짜: ${setlist.worshipDate || "미정"}`,
    `예배 이름: ${setlist.serviceName || "미정"}`,
  ];

  const assignmentGroups = groupTeamAssignments(setlist.teamAssignments);
  if (assignmentGroups.length > 0) {
    lines.push("", "[팀원 파트]");
    assignmentGroups.forEach(({ part, members }) => {
      lines.push(`${part}: ${members.map((member) => member.name || "이름 미정").join(", ")}`);
    });
  }

  lines.push("", "[곡 목록]");

  setlist.songs.forEach((song, index) => {
    lines.push(
      `${index + 1}. ${song.title || "제목 없는 곡"} | Key ${song.practiceKey || song.originalKey || "-"} | BPM ${song.bpm ?? "-"}`,
    );
    if (song.transitionNote) {
      lines.push(`   곡 뒤 멘트/기도: ${song.transitionNote.replace(/\n+/g, " / ")}`);
    }
  });

  if (setlist.globalNotes) {
    lines.push("", "[전체 강조사항]", setlist.globalNotes);
  }

  return lines.join("\n");
}
