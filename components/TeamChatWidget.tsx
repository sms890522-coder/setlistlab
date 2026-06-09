"use client";

import Link from "next/link";
import { TeamChatPanel } from "@/components/TeamChatPanel";
import { getCurrentUser } from "@/lib/auth";
import { getApprovedMemberships, type TeamMembership } from "@/lib/db/teamMemberships";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";

export function TeamChatWidget() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [memberships, setMemberships] = useState<TeamMembership[]>([]);
  const [error, setError] = useState("");

  const activeMembership = useMemo(() => memberships.find((membership) => membership.team), [memberships]);
  const activeTeam = activeMembership?.team;

  useEffect(() => {
    async function loadTeams() {
      if (!isSupabaseConfigured()) {
        setLoaded(true);
        return;
      }

      const user = await getCurrentUser();
      setSignedIn(Boolean(user));
      if (!user) {
        setLoaded(true);
        return;
      }

      setMemberships(await getApprovedMemberships());
      setLoaded(true);
    }

    loadTeams().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "팀 채팅 정보를 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, [open]);

  return (
    <>
      {open ? (
        <section className="team-chat-panel no-print fixed bottom-20 right-4 z-40 flex max-h-[calc(100dvh-6.5rem)] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl sm:bottom-24 sm:right-6 sm:max-h-[34rem]">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-violet-50 p-4">
            <div>
              <p className="text-xs font-black text-blue-700">팀 채팅</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">{activeTeam ? activeTeam.teamName : "팀 채팅"}</h2>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary min-h-9 px-3">
              닫기
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {!loaded ? (
              <div className="p-4 text-sm font-semibold text-slate-500">팀 채팅을 준비하는 중입니다.</div>
            ) : !isSupabaseConfigured() ? (
              <WidgetNotice message="계정 저장 기능이 준비되면 팀 채팅을 사용할 수 있습니다." />
            ) : !signedIn ? (
              <WidgetNotice message="로그인하면 승인된 팀 채팅을 사용할 수 있습니다." href="/login" action="로그인" />
            ) : error ? (
              <WidgetNotice message={error} href="/teams" action="내 팀" />
            ) : activeTeam ? (
              <TeamChatPanel team={activeTeam} compact />
            ) : (
              <WidgetNotice message="승인된 팀이 없습니다. 팀을 만들거나 초대코드로 참여 요청을 보내 주세요." href="/teams" action="내 팀" />
            )}
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="team-chat-widget no-print fixed bottom-4 right-4 z-50 flex size-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xl transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 sm:bottom-6 sm:right-6"
        aria-label="팀 채팅 열기"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 6.5A4.5 4.5 0 0 1 9.5 2h5A4.5 4.5 0 0 1 19 6.5v4A4.5 4.5 0 0 1 14.5 15H12l-4 3v-3.25A4.5 4.5 0 0 1 5 10.5v-4Z" />
          <path d="M9 7h6M9 10h4" />
        </svg>
      </button>
    </>
  );
}

function WidgetNotice({ message, href, action }: { message: string; href?: string; action?: string }) {
  return (
    <div className="space-y-3 p-4">
      <p className="rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-600">{message}</p>
      {href && action ? (
        <Link href={href} className="btn-primary w-full">
          {action}
        </Link>
      ) : null}
    </div>
  );
}
