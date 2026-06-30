"use client";

import Link from "next/link";
import { ExportImportPanel } from "@/components/ExportImportPanel";
import { SetlistComments } from "@/components/SetlistComments";
import { SongCard } from "@/components/SongCard";
import { TeamAssignmentsView } from "@/components/TeamAssignmentsView";
import { getCurrentUser } from "@/lib/auth";
import {
  AVAILABILITY_LABELS,
  getLinkedCalendarEventsForSetlist,
  type AvailabilityStatus,
  type TeamCalendarEventWithAvailability,
} from "@/lib/db/teamCalendar";
import { getGuideTrackSongIds } from "@/lib/db/teamGuideTracks";
import { getMyProfile } from "@/lib/db/profiles";
import { duplicateCloudSetlist, getCloudSetlist, type CloudSetlist } from "@/lib/db/setlists";
import { getMyRoleInTeam, type TeamMembership } from "@/lib/db/teamMemberships";
import { canUseFeature } from "@/lib/features";
import { canManageTeamSetlist } from "@/lib/permissions/teamPermissions";
import { createSampleGuideTrack } from "@/lib/sampleData";
import { duplicateSetlist, getPracticeCompletions, getSetlist, setPracticeCompletion } from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Setlist } from "@/lib/types";
import { useParams, useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";

type StorageMode = "local" | "cloud";

export default function SetlistDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [completedSongs, setCompletedSongs] = useState<Record<string, boolean>>({});
  const [storageMode, setStorageMode] = useState<StorageMode>("local");
  const [linkedEvents, setLinkedEvents] = useState<TeamCalendarEventWithAvailability[]>([]);
  const [loadError, setLoadError] = useState("");
  const [canEdit, setCanEdit] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [teamMembership, setTeamMembership] = useState<TeamMembership | null>(null);
  const [guideTrackSongIds, setGuideTrackSongIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoadError("");

    async function loadSetlist() {
      if (isSupabaseConfigured()) {
        const user = await getCurrentUser();
        if (user) {
          setCurrentUserId(user.id);
          const [profile, cloudSetlist] = await Promise.all([getMyProfile().catch(() => null), getCloudSetlist(params.id)]);
          if (cloudSetlist) {
            const membership = cloudSetlist.teamId ? await getMyRoleInTeam(cloudSetlist.teamId) : null;
            const calendarEvents = cloudSetlist.teamId ? await getLinkedCalendarEventsForSetlist(cloudSetlist.id).catch(() => []) : [];
            const nextGuideTrackSongIds = canUseFeature(profile, "teamGuideTrack")
              ? await getGuideTrackSongIds(cloudSetlist.id).catch(() => new Set<string>())
              : new Set<string>();
            setCanEdit(Boolean(cloudSetlist.ownerId === user.id || canManageTeamSetlist(membership)));
            setTeamMembership(membership);
            setSetlist(cloudSetlist);
            setLinkedEvents(calendarEvents);
            setGuideTrackSongIds(nextGuideTrackSongIds);
            setStorageMode("cloud");
            setCompletedSongs(getPracticeCompletions(params.id));
            setLoaded(true);
            return;
          }
        }
      }

      setCanEdit(true);
      setCurrentUserId(null);
      setTeamMembership(null);
      setSetlist(getSetlist(params.id) ?? null);
      setLinkedEvents([]);
      setGuideTrackSongIds(new Set());
      setStorageMode("local");
      setCompletedSongs(getPracticeCompletions(params.id));
      setLoaded(true);
    }

    loadSetlist().catch((error) => {
      setLoadError(error instanceof Error ? error.message : "콘티를 불러오지 못했습니다.");
      setCurrentUserId(null);
      setTeamMembership(null);
      setSetlist(getSetlist(params.id) ?? null);
      setLinkedEvents([]);
      setGuideTrackSongIds(new Set());
      setStorageMode("local");
      setCompletedSongs(getPracticeCompletions(params.id));
      setLoaded(true);
    });
  }, [params.id]);

  function toggleCompletion(songId: string, completed: boolean) {
    setPracticeCompletion(params.id, songId, completed);
    setCompletedSongs((current) => ({ ...current, [songId]: completed }));
  }

  async function handleDuplicate() {
    const duplicated = storageMode === "cloud" ? await duplicateCloudSetlist(params.id) : duplicateSetlist(params.id);
    router.push(`/setlists/${duplicated.id}/edit`);
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
          <h1 className="text-2xl font-black text-slate-950">콘티를 찾을 수 없습니다</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            이 브라우저에 저장된 콘티가 아니거나, 공유가 끝난 콘티일 수 있습니다. 받은 백업 텍스트가 있다면 가져오기를 사용해 주세요.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href="/setlists" className="btn-secondary">
              목록으로
            </Link>
            <Link href="/import" className="btn-primary">
              백업 텍스트 가져오기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const completedCount = setlist.songs.filter((song) => completedSongs[song.id]).length;
  const cloudOwnerId = storageMode === "cloud" ? (setlist as CloudSetlist).ownerId : undefined;
  const canUseComments =
    storageMode === "cloud" &&
    Boolean(setlist.teamId ? teamMembership?.status === "approved" : cloudOwnerId && cloudOwnerId === currentUserId);
  const canManageComments = Boolean(setlist.teamId ? canManageTeamSetlist(teamMembership) : cloudOwnerId && cloudOwnerId === currentUserId);

  return (
    <div data-guide-shot="view-setlist" className="page-shell space-y-6">
      <section className="card overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 via-white to-violet-50 p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-bold text-blue-700">
                {setlist.worshipDate || "날짜 미정"} · {setlist.serviceName || "예배 이름 미정"}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{setlist.title}</h1>
              {setlist.description ? (
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700">{setlist.description}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/setlists/${setlist.id}/play`} className="btn-primary">
                콘티 연속재생 시작
              </Link>
              {canEdit ? (
                <>
                  <Link href={`/setlists/${setlist.id}/pdf`} className="btn-secondary">
                    PDF 만들기
                  </Link>
                  <Link href={`/setlists/${setlist.id}/edit`} className="btn-secondary">
                    수정
                  </Link>
                </>
              ) : null}
              <button type="button" onClick={handleDuplicate} className="btn-secondary">
                복제
              </button>
              <button type="button" onClick={() => router.refresh()} className="btn-secondary">
                새로고침
              </button>
            </div>
          </div>
        </div>

        {setlist.globalNotes ? (
          <div className="border-t border-slate-100 p-5 sm:p-7">
            <h2 className="font-bold text-slate-950">전체 강조사항</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">{setlist.globalNotes}</p>
          </div>
        ) : null}
      </section>

      {loadError ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{loadError}</p> : null}
      {storageMode === "local" ? (
        <section className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
          이 콘티는 현재 브라우저에 임시 저장되어 있습니다. 로그인하면 새 콘티부터 계정 저장소에 저장됩니다.
        </section>
      ) : null}

      <TeamAssignmentsView assignments={setlist.teamAssignments} />

      {linkedEvents.length > 0 ? <LinkedCalendarEvents events={linkedEvents} /> : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-title">곡 목록</h2>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
              연습 완료 {completedCount}/{setlist.songs.length}
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
              {setlist.songs.length}곡
            </span>
          </div>
        </div>
        {setlist.songs.length === 0 ? (
          <div className="card p-8 text-center">
            <h3 className="text-xl font-black text-slate-950">아직 곡이 없습니다</h3>
            <p className="mt-2 text-sm text-slate-600">수정 화면에서 찬양곡을 추가해 주세요.</p>
            <Link href={`/setlists/${setlist.id}/edit`} className="btn-primary mt-5">
              곡 추가하기
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {setlist.songs.map((song, index) => (
              <Fragment key={song.id}>
                <SongCard
                  song={song}
                  index={index}
                  href={`/setlists/${setlist.id}/songs/${song.id}`}
                  completed={Boolean(completedSongs[song.id])}
                  hasGuideTrack={guideTrackSongIds.has(song.id) || Boolean(createSampleGuideTrack(setlist, song))}
                  onCompletionChange={(completed) => toggleCompletion(song.id, completed)}
                />
                {song.transitionNote ? (
                  <div className="mx-3 rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm leading-6 text-violet-800">
                    <p className="text-xs font-black text-violet-600">곡 뒤 멘트/기도</p>
                    <p className="mt-1 whitespace-pre-line">{song.transitionNote}</p>
                  </div>
                ) : null}
              </Fragment>
            ))}
          </div>
        )}
      </section>

      {canUseComments ? (
        <SetlistComments
          setlistId={setlist.id}
          canComment={canUseComments}
          canManageComments={canManageComments}
          scopeLabel={setlist.teamId ? "팀원 전용" : "개인 콘티"}
        />
      ) : null}

      <ExportImportPanel setlist={setlist} onImported={(imported) => router.push(`/setlists/${imported.id}`)} />
    </div>
  );
}

function LinkedCalendarEvents({ events }: { events: TeamCalendarEventWithAvailability[] }) {
  return (
    <section className="card p-5">
      <h2 className="section-title">연결된 팀 캘린더 일정</h2>
      <p className="mt-1 text-sm text-slate-500">가능 인원은 실제 섬김 배정이 아니라 리더가 팀원 지정을 할 때 참고하는 정보입니다.</p>
      <div className="mt-4 grid gap-3">
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/teams/${event.teamId}/calendar/${event.id}`}
            className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:bg-blue-50"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-black text-slate-950">{event.title}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {formatCalendarDate(event.eventDate)}
                  {event.startTime ? ` · ${event.startTime}` : ""}
                </p>
              </div>
              <CalendarSummary summary={event.summary} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function CalendarSummary({ summary }: { summary: Record<AvailabilityStatus, number> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(["available", "unavailable", "maybe", "unknown"] as AvailabilityStatus[]).map((status) => (
        <span key={status} className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">
          {AVAILABILITY_LABELS[status]} {summary[status]}
        </span>
      ))}
    </div>
  );
}

function formatCalendarDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}
