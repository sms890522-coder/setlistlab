"use client";

import Link from "next/link";
import { getSharedSetlistCount } from "@/lib/supabase";
import { useEffect, useState } from "react";

export default function HomePage() {
  const [sharedCount, setSharedCount] = useState(0);
  const [countLoaded, setCountLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getSharedSetlistCount()
      .then((count) => {
        if (cancelled) return;
        setSharedCount(count);
      })
      .catch(() => {
        if (cancelled) return;
        setSharedCount(0);
      })
      .finally(() => {
        if (!cancelled) setCountLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page-shell">
      <section className="grid min-h-[calc(100vh-8rem)] items-center gap-8 py-8 lg:grid-cols-[1.04fr_0.96fr]">
        <div className="space-y-7">
          <div className="inline-flex rounded-full border border-blue-100 bg-white/80 px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm">
            찬양팀 콘티 연습실
          </div>
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <img
                src="/conti-logo.jpg"
                alt=""
                width="64"
                height="64"
                className="size-14 rounded-2xl shadow-sm sm:size-16"
                aria-hidden="true"
              />
              <h1 className="text-4xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                콘티연습실
              </h1>
            </div>
            <p className="max-w-2xl text-2xl font-bold leading-snug text-slate-800 sm:text-3xl">
              찬양팀을 위한 유튜브 구간반복 콘티 공유 도구
            </p>
            <p className="max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
              이번 주 콘티곡을 등록하고, 곡별 구성과 강조사항을 팀원들과 공유하세요.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/setlists/new" className="btn-primary">
              새 콘티 만들기
            </Link>
            <Link href="/setlists" className="btn-secondary">
              샘플 콘티 보기
            </Link>
            <Link href="/login" className="btn-secondary">
              로그인하고 저장하기
            </Link>
            <Link href="/tools/tuner" className="btn-secondary">
              튜너 열기
            </Link>
          </div>
          <p className="max-w-xl rounded-xl border border-blue-100 bg-white/75 p-4 text-sm leading-6 text-slate-600">
            로그인 전에는 이 브라우저에 임시 저장되고, 로그인하면 Supabase 계정 저장소에 콘티와 곡 보관함, 팀원 목록을
            저장합니다.
          </p>
          <div className="w-fit rounded-2xl border border-blue-100 bg-white/85 px-5 py-4 shadow-sm">
            <p className="text-sm font-bold text-slate-500">현재까지 공유된 콘티</p>
            <p className="mt-1 text-3xl font-black text-blue-700">
              {countLoaded ? sharedCount.toLocaleString("ko-KR") : "-"}
              <span className="ml-1 text-base font-bold text-slate-500">개</span>
            </p>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-violet-50 p-5">
            <p className="text-sm font-semibold text-blue-700">이번 주 콘티</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">주일 2부예배</h2>
          </div>
          <div className="space-y-3 p-5">
            {[
              ["1", "나는 예배자입니다", "F", "68", "Intro - Verse1 - Chorus"],
              ["2", "주님은 산 같아서", "A", "72", "Verse - Chorus - Bridge"],
              ["3", "예수 열방의 소망", "G", "120", "Pre-Chorus - Chorus - Ending"],
            ].map(([order, title, keyName, bpm, sections]) => (
              <div key={title} className="rounded-xl border border-slate-100 bg-white p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                    {order}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-950">{title}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Key {keyName} · BPM {bpm}
                    </p>
                    <p className="mt-2 truncate text-sm text-slate-600">{sections}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
