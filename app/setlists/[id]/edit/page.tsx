"use client";

import Link from "next/link";
import { PreviousSetlistImportPanel } from "@/components/PreviousSetlistImportPanel";
import { SongLibraryPanel } from "@/components/SongLibraryPanel";
import { SongForm } from "@/components/SongForm";
import { TeamAssignmentsEditor } from "@/components/TeamAssignmentsEditor";
import { getCurrentUser } from "@/lib/auth";
import { getMyProfile } from "@/lib/db/profiles";
import { getCloudSetlist, getCloudSetlists, saveCloudSetlist } from "@/lib/db/setlists";
import { deleteCloudSongFromLibrary, getCloudSongLibrary } from "@/lib/db/savedSongs";
import {
  getMyRoleInTeam,
  getTeamMembers as getApprovedTeamMembers,
  type TeamMembership,
} from "@/lib/db/teamMemberships";
import {
  getTeamMembers as getPersonalTeamMembers,
  teamMemberToAssignment,
  type TeamMember,
} from "@/lib/db/teamMembers";
import { cloneSong, createBlankSong } from "@/lib/factories";
import { formatMemberNameWithEmoji } from "@/lib/roleEmoji";
import { deleteSongFromLibrary, getSetlists, getSongLibrary, saveSetlist } from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { DEFAULT_TEAM_PARTS, type SavedSong, type Setlist, type Song, type TeamAssignment } from "@/lib/types";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type StorageMode = "local" | "cloud";
type AssignmentMode = "team" | "personal" | "local";

export default function SetlistEditPage() {
  const params = useParams<{ id: string }>();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [saveError, setSaveError] = useState("");
  const [library, setLibrary] = useState<SavedSong[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryMessage, setLibraryMessage] = useState("");
  const [previousSetlists, setPreviousSetlists] = useState<Setlist[]>([]);
  const [storageMode, setStorageMode] = useState<StorageMode>("local");
  const [personalTeamMembers, setPersonalTeamMembers] = useState<TeamMember[]>([]);
  const [approvedTeamMembers, setApprovedTeamMembers] = useState<TeamMembership[]>([]);
  const saveRequestIdRef = useRef(0);

  useEffect(() => {
    saveRequestIdRef.current += 1;
    setSaveError("");

    async function loadSetlist() {
      const localSetlists = getSetlists();

      if (isSupabaseConfigured()) {
        const user = await getCurrentUser();
        if (user) {
          const profile = await getMyProfile();
          if (!profile) {
            window.location.href = `/onboarding?redirect=${encodeURIComponent(`/setlists/${params.id}/edit`)}`;
            return;
          }

          const cloudSetlist = await getCloudSetlist(params.id);
          if (cloudSetlist) {
            const membership = cloudSetlist.teamId ? await getMyRoleInTeam(cloudSetlist.teamId) : null;
            const canEditCloudSetlist = cloudSetlist.ownerId === user.id || ["owner", "admin"].includes(membership?.role ?? "");
            if (!canEditCloudSetlist) {
              setSetlist(null);
              setSaveError("이 콘티는 작성자 또는 팀 리더/관리자만 수정할 수 있습니다. 내 콘티로 따로 수정하려면 복제해서 사용해 주세요.");
              setLoaded(true);
              return;
            }

            const isTeamSetlist = Boolean(cloudSetlist.teamId);
            const [cloudSetlists, cloudLibrary, savedTeamMembers, actualTeamMembers] = await Promise.all([
              getCloudSetlists(),
              getCloudSongLibrary(),
              isTeamSetlist ? Promise.resolve([]) : getPersonalTeamMembers(),
              isTeamSetlist && cloudSetlist.teamId ? getApprovedTeamMembers(cloudSetlist.teamId) : Promise.resolve([]),
            ]);
            setSetlist(cloudSetlist);
            setPreviousSetlists(
              cloudSetlists.filter((item) => item.id !== params.id && item.teamId === cloudSetlist.teamId),
            );
            setLibrary(cloudLibrary);
            setPersonalTeamMembers(savedTeamMembers);
            setApprovedTeamMembers(actualTeamMembers);
            setStorageMode("cloud");
            setLoaded(true);
            return;
          }
        }
      }

      setSetlist(localSetlists.find((item) => item.id === params.id) ?? null);
      setPreviousSetlists(localSetlists.filter((item) => item.id !== params.id));
      setLibrary(getSongLibrary());
      setPersonalTeamMembers([]);
      setApprovedTeamMembers([]);
      setStorageMode("local");
      setLoaded(true);
    }

    loadSetlist().catch((loadError) => {
      const allSetlists = getSetlists();
      setSetlist(allSetlists.find((item) => item.id === params.id) ?? null);
      setPreviousSetlists(allSetlists.filter((item) => item.id !== params.id));
      setLibrary(getSongLibrary());
      setPersonalTeamMembers([]);
      setApprovedTeamMembers([]);
      setStorageMode("local");
      setSaveError(loadError instanceof Error ? loadError.message : "콘티를 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, [params.id]);

  function persist(next: Setlist) {
    const optimistic = { ...next, updatedAt: new Date().toISOString() };
    setSetlist(optimistic);

    try {
      if (storageMode === "cloud") {
        const saveRequestId = saveRequestIdRef.current + 1;
        saveRequestIdRef.current = saveRequestId;
        saveCloudSetlist(optimistic)
          .then((saved) => {
            if (saveRequestId !== saveRequestIdRef.current) return;
            setSetlist(saved);
            setSaveError("");
            setSavedAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
          })
          .catch((error) => {
            if (saveRequestId !== saveRequestIdRef.current) return;
            setSaveError(error instanceof Error ? error.message : "계정 저장소 자동 저장에 실패했습니다.");
          });
        return;
      }

      const saved = saveSetlist(optimistic);
      setSetlist(saved);
      setSaveError("");
      setSavedAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch {
      setSaveError("자동 저장에 실패했습니다. 브라우저 저장 공간과 권한을 확인해 주세요.");
    }
  }

  function updateSetlist(patch: Partial<Setlist>) {
    if (!setlist) return;
    persist({ ...setlist, ...patch });
  }

  function updateSong(songId: string, nextSong: Song) {
    if (!setlist) return;
    persist({
      ...setlist,
      songs: setlist.songs.map((song) => (song.id === songId ? nextSong : song)),
    });
  }

  function moveSong(index: number, direction: -1 | 1) {
    if (!setlist) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= setlist.songs.length) return;
    const songs = [...setlist.songs];
    const [song] = songs.splice(index, 1);
    songs.splice(nextIndex, 0, song);
    persist({ ...setlist, songs });
  }

  async function handleLibrarySaved(saved: SavedSong, overwritten: boolean) {
    setLibrary(storageMode === "cloud" ? await getCloudSongLibrary() : getSongLibrary());
    setLibraryMessage(
      overwritten
        ? `${saved.song.title || "곡"}의 보관함 정보를 덮어썼습니다.`
        : `${saved.song.title || "곡"}을 보관함에 저장했습니다.`,
    );
  }

  function addFromLibrary(savedSong: SavedSong) {
    if (!setlist) return;
    persist({ ...setlist, songs: [...setlist.songs, cloneSong(savedSong.song)] });
    setLibraryMessage(`${savedSong.song.title || "곡"}을 콘티에 추가했습니다.`);
  }

  async function deleteFromLibrary(id: string) {
    try {
      if (storageMode === "cloud") {
        await deleteCloudSongFromLibrary(id);
        setLibrary(await getCloudSongLibrary());
      } else {
        deleteSongFromLibrary(id);
        setLibrary(getSongLibrary());
      }
      setLibraryMessage("곡을 보관함에서 삭제했습니다.");
    } catch (deleteError) {
      setLibraryMessage("");
      setSaveError(deleteError instanceof Error ? deleteError.message : "곡을 삭제하지 못했습니다.");
    }
  }

  function importSongsFromPrevious(songs: Song[]) {
    if (!setlist || songs.length === 0) return;
    persist({ ...setlist, songs: [...setlist.songs, ...songs] });
    setLibraryMessage(`${songs.length}곡을 현재 콘티에 추가했습니다.`);
  }

  function importTeamAssignmentsFromPrevious(teamAssignments: TeamAssignment[]) {
    if (!setlist) return;
    persist({ ...setlist, teamAssignments });
    setLibraryMessage("팀원 파트 배정을 불러왔습니다.");
  }

  function addAssignmentToSetlist(assignment: TeamAssignment, sourceLabel: string) {
    if (!setlist) return;
    const exists = setlist.teamAssignments.some(
      (item) => item.id === assignment.id || (item.name === assignment.name && item.part === assignment.part),
    );
    if (exists) {
      setLibraryMessage(`${assignment.part}: ${assignment.name}은 이미 이번 주 팀원에 있습니다.`);
      return;
    }
    persist({ ...setlist, teamAssignments: [...setlist.teamAssignments, assignment] });
    setLibraryMessage(`${sourceLabel}에서 ${assignment.part}: ${assignment.name}을 이번 주 팀원에 추가했습니다.`);
  }

  if (!loaded) {
    return (
      <div className="page-shell">
        <div className="card p-8 text-sm text-slate-500">콘티를 불러오는 중입니다.</div>
      </div>
    );
  }

  if (!setlist) {
    return (
      <div className="page-shell">
        <div className="card p-8 text-center">
          <h1 className="text-2xl font-black text-slate-950">수정할 콘티를 찾을 수 없습니다</h1>
          {saveError ? <p className="mt-3 text-sm leading-6 text-rose-700">{saveError}</p> : null}
          <Link href="/setlists" className="btn-primary mt-5">
            목록으로
          </Link>
        </div>
      </div>
    );
  }

  const assignmentMode = getAssignmentMode(storageMode, setlist);
  const assignmentSuggestions =
    assignmentMode === "team"
      ? approvedTeamMembers.map(teamMembershipToAssignment)
      : assignmentMode === "personal"
        ? personalTeamMembers.map(teamMemberToAssignment)
        : [];
  const assignmentSuggestionCopy = getAssignmentSuggestionCopy(assignmentMode, setlist);

  return (
    <div className="page-shell space-y-6 pb-20">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={`text-sm font-bold ${saveError ? "text-rose-700" : "text-blue-700"}`}>
            {saveError || `자동 저장 ${savedAt ? `· ${savedAt}` : "대기 중"}`}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">콘티 수정</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            입력한 내용은 {storageMode === "cloud" ? "계정 클라우드" : "이 브라우저"}에 자동 저장됩니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/setlists/${setlist.id}`} className="btn-primary">
            콘티 보기
          </Link>
          <Link href="/setlists" className="btn-secondary">
            목록
          </Link>
        </div>
      </section>

      <section className="card p-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-1 lg:col-span-2">
            <span className="field-label">콘티 제목</span>
            <input
              value={setlist.title}
              onChange={(event) => updateSetlist({ title: event.target.value })}
              className="field-input"
              placeholder="2026년 6월 7일 주일예배 콘티"
            />
          </label>
          <label className="space-y-1">
            <span className="field-label">예배 날짜</span>
            <input
              value={setlist.worshipDate}
              onChange={(event) => updateSetlist({ worshipDate: event.target.value })}
              className="field-input"
              type="date"
            />
          </label>
          <label className="space-y-1">
            <span className="field-label">예배 이름</span>
            <input
              value={setlist.serviceName}
              onChange={(event) => updateSetlist({ serviceName: event.target.value })}
              className="field-input"
              placeholder="주일 2부예배"
            />
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="field-label">전체 설명</span>
            <textarea
              value={setlist.description ?? ""}
              onChange={(event) => updateSetlist({ description: event.target.value })}
              className="field-input min-h-24 resize-y"
              placeholder="오늘은 고백적인 흐름으로 진행합니다."
            />
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="field-label">전체 강조사항</span>
            <textarea
              value={setlist.globalNotes ?? ""}
              onChange={(event) => updateSetlist({ globalNotes: event.target.value })}
              className="field-input min-h-28 resize-y"
              placeholder="곡 사이 전환, 다이내믹, 인도자 멘트 등을 적어주세요."
            />
          </label>
        </div>
      </section>

      <TeamAssignmentsEditor
        assignments={setlist.teamAssignments}
        mode={assignmentMode}
        onChange={(teamAssignments) => updateSetlist({ teamAssignments })}
      />

      {assignmentMode !== "local" ? (
        <section className="card p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="section-title">{assignmentSuggestionCopy.title}</h2>
              <p className="field-help">{assignmentSuggestionCopy.help}</p>
            </div>
            {assignmentMode === "personal" ? (
              <Link href="/team" className="btn-secondary min-h-10 px-3">
                임의 팀원 관리
              </Link>
            ) : null}
          </div>
          {assignmentSuggestions.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
              {assignmentSuggestionCopy.empty}
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {assignmentSuggestions.map((assignment) => (
                <button
                  key={assignment.id}
                  type="button"
                  onClick={() => addAssignmentToSetlist(assignment, assignmentSuggestionCopy.sourceLabel)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
                >
                  <span className="text-blue-700">{assignment.part}</span>: {formatMemberNameWithEmoji(assignment.part, assignment.name)}
                </button>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <PreviousSetlistImportPanel
        setlists={previousSetlists}
        onImportSongs={importSongsFromPrevious}
        onImportTeamAssignments={importTeamAssignmentsFromPrevious}
      />

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="section-title">곡 목록</h2>
            <p className="field-help">곡을 추가하고 순서를 조정하세요.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setLibraryOpen((value) => !value)} className="btn-secondary">
              {libraryOpen ? "곡 보관함 닫기" : "보관함에서 불러오기"}
            </button>
            <button
              type="button"
              onClick={() => persist({ ...setlist, songs: [...setlist.songs, createBlankSong()] })}
              className="btn-primary"
            >
              새 곡 추가
            </button>
          </div>
        </div>

        {libraryOpen ? <SongLibraryPanel songs={library} onAdd={addFromLibrary} onDelete={deleteFromLibrary} /> : null}
        {libraryMessage ? (
          <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{libraryMessage}</p>
        ) : null}

        {setlist.songs.length === 0 ? (
          <div className="card p-8 text-center">
            <h3 className="text-xl font-black text-slate-950">곡을 추가해 주세요</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              유튜브 링크, 구성, 파트별 메모를 한 곡씩 정리할 수 있습니다.
            </p>
            <button
              type="button"
              onClick={() => persist({ ...setlist, songs: [...setlist.songs, createBlankSong()] })}
              className="btn-primary mt-5"
            >
              첫 곡 추가
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {setlist.songs.map((song, index) => (
              <SongForm
                key={song.id}
                song={song}
                index={index}
                onChange={(nextSong) => updateSong(song.id, nextSong)}
                onDelete={() => persist({ ...setlist, songs: setlist.songs.filter((item) => item.id !== song.id) })}
                onMoveUp={() => moveSong(index, -1)}
                onMoveDown={() => moveSong(index, 1)}
                onLibrarySaved={handleLibrarySaved}
                canMoveUp={index > 0}
                canMoveDown={index < setlist.songs.length - 1}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function getAssignmentMode(storageMode: StorageMode, setlist: Setlist): AssignmentMode {
  if (storageMode === "cloud" && setlist.teamId) return "team";
  if (storageMode === "cloud") return "personal";
  return "local";
}

function getAssignmentSuggestionCopy(mode: AssignmentMode, setlist: Setlist) {
  if (mode === "team") {
    return {
      title: "가입한 팀원 불러오기",
      help: "이 팀 콘티는 승인된 실제 팀원 목록을 기준으로 배정합니다.",
      empty: "아직 승인된 팀원이 없습니다. 팀 대시보드에서 초대코드로 팀원을 승인한 뒤 사용할 수 있습니다.",
      sourceLabel: "가입한 팀원",
    };
  }

  if (mode === "personal") {
    return {
      title: "임의 저장한 팀원 불러오기",
      help: "개인 콘티는 실제 팀 멤버십과 분리된 내 계정의 임의 팀원 목록을 사용합니다.",
      empty: "아직 임의 저장한 팀원이 없습니다. 팀원 관리에서 자주 쓰는 이름과 파트를 저장해둘 수 있습니다.",
      sourceLabel: "임의 저장 팀원",
    };
  }

  return {
    title: "임의 팀원 직접 입력",
    help: "이 콘티는 로그인 없이 이 브라우저에만 저장됩니다.",
    empty: "위 입력칸에서 필요한 팀원을 직접 추가해 주세요.",
    sourceLabel: setlist.title || "임시 콘티",
  };
}

function teamMembershipToAssignment(member: TeamMembership): TeamAssignment {
  const rawPart = member.position || getMembershipProfileRole(member) || "팀원";
  const part = normalizeAssignmentPart(rawPart);
  const name = member.profile?.displayName || "팀원";
  return {
    id: member.id,
    name,
    part,
    note: getMembershipNote(member),
  };
}

function getMembershipProfileRole(member: TeamMembership) {
  if (!member.profile) return "";
  if (member.profile.role === "기타" && member.profile.customRole) return member.profile.customRole;
  return member.profile.role || "";
}

function getMembershipNote(member: TeamMembership) {
  if (member.role === "owner") return "팀 리더";
  if (member.role === "admin") return "팀 관리자";
  return undefined;
}

function normalizeAssignmentPart(part: string) {
  const mapped = ROLE_TO_ASSIGNMENT_PART[part] ?? part;
  return DEFAULT_TEAM_PARTS.includes(mapped as (typeof DEFAULT_TEAM_PARTS)[number]) ? mapped : "기타";
}

const ROLE_TO_ASSIGNMENT_PART: Record<string, string> = {
  찬양인도자: "인도자",
  일렉기타: "일렉",
  어쿠스틱기타: "어쿠스틱",
  미디어: "방송",
};
