"use client";

import Link from "next/link";
import { TeamCalendarEventForm } from "@/components/TeamCalendarEventForm";
import {
  createRecurringTeamCalendarEvents,
  createTeamCalendarEvent,
  type RecurringTeamCalendarEventInput,
  type TeamCalendarEventInput,
} from "@/lib/db/teamCalendar";
import { getCloudSetlists } from "@/lib/db/setlists";
import { getMyRoleInTeam, type TeamMembership } from "@/lib/db/teamMemberships";
import { getTeam, type Team } from "@/lib/db/teams";
import { canCreateTeamCalendarEvent } from "@/lib/permissions/teamPermissions";
import type { Setlist } from "@/lib/types";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function NewTeamCalendarEventPage() {
  const params = useParams<{ teamId: string }>();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [membership, setMembership] = useState<TeamMembership | null>(null);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPage() {
      const [nextTeam, nextMembership, cloudSetlists] = await Promise.all([
        getTeam(params.teamId),
        getMyRoleInTeam(params.teamId),
        getCloudSetlists().catch(() => []),
      ]);
      setTeam(nextTeam);
      setMembership(nextMembership);
      setSetlists(cloudSetlists.filter((setlist) => setlist.teamId === params.teamId));
      setLoaded(true);
    }

    loadPage().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "일정 만들기 화면을 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, [params.teamId]);

  async function handleSubmit(input: TeamCalendarEventInput) {
    try {
      setSubmitting(true);
      setError("");
      setMessage("");
      const event = await createTeamCalendarEvent(input);
      router.push(`/teams/${params.teamId}/calendar/${event.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "팀 일정을 등록하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecurringSubmit(input: RecurringTeamCalendarEventInput) {
    try {
      setSubmitting(true);
      setError("");
      setMessage("");
      const result = await createRecurringTeamCalendarEvents(input);
      setMessage(createRecurringResultMessage(result.totalCount, result.createdCount, result.skippedCount));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "반복 일정을 생성하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  const canManage = canCreateTeamCalendarEvent(membership);

  if (!loaded) {
    return <div className="page-shell"><div className="card p-8 text-sm text-slate-500">일정 만들기 화면을 준비하는 중입니다.</div></div>;
  }

  if (!team || !canManage) {
    return (
      <div className="page-shell">
        <section className="card p-8 text-center">
          <h1 className="text-2xl font-black text-slate-950">일정 만들기 권한이 없습니다</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">팀 리더와 부리더만 일정을 만들 수 있습니다.</p>
          <Link href={team ? `/teams/${team.id}/calendar` : "/teams"} className="btn-primary mt-5">돌아가기</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell max-w-3xl space-y-6 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-blue-700">{team.churchName} · {team.teamName}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">새 팀 일정</h1>
        </div>
        <Link href={`/teams/${team.id}/calendar`} className="btn-secondary">캘린더</Link>
      </div>

      {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      {message ? (
        <div className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-700">
          <p>{message}</p>
          <Link href={`/teams/${team.id}/calendar`} className="mt-3 inline-flex text-emerald-800 underline">
            팀 캘린더에서 확인하기
          </Link>
        </div>
      ) : null}
      <TeamCalendarEventForm
        teamId={team.id}
        mode="create"
        setlists={setlists}
        submitting={submitting}
        onSubmit={handleSubmit}
        onRecurringSubmit={handleRecurringSubmit}
      />
    </div>
  );
}

function createRecurringResultMessage(totalCount: number, createdCount: number, skippedCount: number) {
  if (skippedCount > 0) {
    return `총 ${totalCount}개 중 ${createdCount}개 일정이 생성되었습니다. ${skippedCount}개는 기존 일정과 겹쳐 건너뛰었습니다.`;
  }

  return `반복 일정이 생성되었습니다. 총 ${totalCount}개 중 ${createdCount}개 일정이 생성되었습니다.`;
}
