"use client";

import Link from "next/link";
import { FaqSection } from "@/components/FaqSection";
import { getCurrentSession, getCurrentUser } from "@/lib/auth";
import { faqJsonLd } from "@/lib/faq";
import { getWeeklyTeamSetlistForUser, type WeeklyHomeSetlistResult } from "@/lib/home/getWeeklyTeamSetlist";
import { getSharedSetlistCount } from "@/lib/supabase";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

type AuthStatus = "loading" | "signedIn" | "signedOut";
type SharedCountStatus = "loading" | "ready" | "unavailable";
type WeeklySetlistStatus = "idle" | "loading" | "ready" | "error";
type HomeFeature = {
  icon: string;
  title: string;
  description: string;
  isNew?: boolean;
};
type HomeFeatureGroup = {
  eyebrow: string;
  title: string;
  features: HomeFeature[];
  isNew?: boolean;
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "콘티연습실",
  alternateName: "SetlistLab",
  url: "https://setlistlab.vercel.app/",
  description: "찬양팀을 위한 콘티 작성, 연습, 팀 공유 도구",
};

const softwareApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "콘티연습실",
  alternateName: "SetlistLab",
  applicationCategory: "MusicApplication",
  operatingSystem: "Web",
  url: "https://setlistlab.vercel.app/",
  description: "찬양팀을 위한 콘티 작성, 유튜브 연습, PDF 저장, 팀 공유 도구",
};

export function HomePageClient() {
  const [sharedCount, setSharedCount] = useState<number | null>(null);
  const [countStatus, setCountStatus] = useState<SharedCountStatus>("loading");
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [weeklySetlist, setWeeklySetlist] = useState<WeeklyHomeSetlistResult | null>(null);
  const [weeklySetlistStatus, setWeeklySetlistStatus] = useState<WeeklySetlistStatus>("idle");

  useEffect(() => {
    let cancelled = false;

    getSharedSetlistCount()
      .then((count) => {
        if (cancelled) return;
        setSharedCount(count);
        setCountStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setSharedCount(null);
        setCountStatus("unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadWeeklySetlist() {
      if (authStatus !== "signedIn") {
        setWeeklySetlist(null);
        setWeeklySetlistStatus("idle");
        return;
      }

      setWeeklySetlistStatus("loading");
      try {
        const result = await getWeeklyTeamSetlistForUser();
        if (cancelled) return;
        setWeeklySetlist(result);
        setWeeklySetlistStatus("ready");
      } catch {
        if (cancelled) return;
        setWeeklySetlist(null);
        setWeeklySetlistStatus("error");
      }
    }

    void loadWeeklySetlist();

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  useEffect(() => {
    let cancelled = false;

    async function loadAuth() {
      if (!isSupabaseConfigured()) {
        setAuthStatus("signedOut");
        return;
      }

      const session = await getCurrentSession();
      const user = session?.user ?? (await getCurrentUser());
      if (!cancelled) {
        setAuthStatus(user ? "signedIn" : "signedOut");
      }
    }

    loadAuth();

    if (!isSupabaseConfigured()) {
      return () => {
        cancelled = true;
      };
    }

    const supabase = getSupabaseBrowserClient();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthStatus(session?.user ? "signedIn" : "signedOut");
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const signedIn = authStatus === "signedIn";
  const realWeeklySetlist = signedIn && weeklySetlist?.status === "ready" ? weeklySetlist.setlist : null;
  const weeklyCardTitle = realWeeklySetlist?.serviceName || realWeeklySetlist?.title || (signedIn ? "이번 주 팀 콘티" : "주일 2부예배");
  const weeklyCardMeta = realWeeklySetlist
    ? [realWeeklySetlist.teamName, formatHomeDate(realWeeklySetlist.serviceDate)].filter(Boolean).join(" · ")
    : null;
  const weeklyPlayHref = realWeeklySetlist ? `/setlists/${realWeeklySetlist.id}/play` : null;
  const weeklyPdfHref = realWeeklySetlist ? `/setlists/${realWeeklySetlist.id}/pdf` : null;
  const weeklyTeamChatHref = realWeeklySetlist ? `/teams/${realWeeklySetlist.teamId}/chat` : null;
  const demoSongs = [
    { order: "1", title: "나는 예배자입니다", keyName: "F", bpm: "68", sections: "Intro - Verse1 - Chorus" },
    { order: "2", title: "주님은 산 같아서", keyName: "A", bpm: "72", sections: "Verse - Chorus - Bridge" },
    { order: "3", title: "예수 열방의 소망", keyName: "G", bpm: "120", sections: "Pre-Chorus - Chorus - Ending" },
  ];
  const storageMessage =
    authStatus === "loading"
      ? "계정 저장 상태를 확인하는 중입니다."
      : signedIn
        ? "계정 클라우드에 콘티, 곡 보관함, 팀 정보와 알림 설정을 저장해서 다른 기기에서도 이어서 사용할 수 있습니다."
        : "로그인 전에는 이 브라우저에 임시 저장되고, 로그인하면 계정 클라우드에 콘티, 곡 보관함, 팀 정보와 알림 설정을 저장합니다.";

  const featureGroups: HomeFeatureGroup[] = [
    {
      eyebrow: "콘티 준비",
      title: "리더가 빠르게 정리하는 예배 흐름",
      features: [
        {
          icon: "📝",
          title: "콘티 작성",
          description: "예배 날짜, 예배 이름, 전체 설명과 강조사항을 한 번에 정리합니다.",
        },
        {
          icon: "🎵",
          title: "송폼 관리",
          description: "Intro, Verse, Chorus 같은 곡 구성을 시간 구간과 함께 저장합니다.",
        },
        {
          icon: "💬",
          title: "곡별 메모",
          description: "곡 설명, 강조사항, 파트별 메모와 곡 사이 멘트까지 남길 수 있습니다.",
        },
        {
          icon: "📚",
          title: "곡 보관함",
          description: "한 번 정리한 곡을 보관해두고 다음 콘티에서 다시 불러옵니다.",
        },
      ],
    },
    {
      eyebrow: "연습 도구",
      title: "팀원이 바로 연습할 수 있는 곡 상세 화면",
      features: [
        {
          icon: "▶️",
          title: "유튜브 구간반복",
          description: "곡 구간을 눌러 이동하고 필요한 부분만 반복해서 연습합니다.",
        },
        {
          icon: "⏱️",
          title: "속도 조절",
          description: "느린 속도로 먼저 맞추고 익숙해지면 원속도로 올릴 수 있습니다.",
        },
        {
          icon: "🎸",
          title: "카포/조옮김",
          description: "연습키에 맞는 코드폼, 카포, 코드 진행 변환을 참고합니다.",
        },
        {
          icon: "🎚️",
          title: "튜너 & 메트로놈",
          description: "악기 튜닝과 BPM 박자 연습을 브라우저 안에서 바로 사용합니다.",
        },
      ],
    },
    {
      eyebrow: "악보와 공유",
      title: "자료를 찾고 팀에게 보기 좋게 전달하기",
      features: [
        {
          icon: "🖼️",
          title: "악보 이미지",
          description: "직접 등록한 악보 이미지를 곡에 저장하고 연습 화면에서 확인합니다.",
        },
        {
          icon: "🔎",
          title: "악보 검색 도우미",
          description: "곡 제목으로 악보 이미지와 코드 악보 검색을 새 탭에서 빠르게 엽니다.",
        },
        {
          icon: "📄",
          title: "PDF 만들기",
          description: "곡 순서, 송폼, 메모, 악보 이미지를 인쇄용 PDF로 정리합니다.",
        },
        {
          icon: "📲",
          title: "카톡 공유 요약",
          description: "예배 날짜, 곡 목록, 키, BPM, 팀원 파트를 붙여넣기 좋은 텍스트로 만듭니다.",
        },
      ],
    },
    {
      eyebrow: "팀 운영",
      title: "초대부터 채팅, 알림까지 한 팀으로 묶기",
      features: [
        {
          icon: "🪪",
          title: "초대코드 팀 참여",
          description: "리더가 초대코드를 공유하고 승인한 팀원만 팀 공간에 들어옵니다.",
        },
        {
          icon: "👥",
          title: "팀원 파트 배정",
          description: "인도자, 싱어, 일렉, 건반, 드럼 등 이번 주 섬김 파트를 정리합니다.",
        },
        {
          icon: "💭",
          title: "팀 채팅",
          description: "콘티 공지와 연습 포인트를 팀 안에서 바로 나눕니다.",
        },
        {
          icon: "💌",
          title: "팀원 1:1 대화",
          description: "같은 팀 안의 특정 팀원과 개인적으로 확인할 내용을 주고받습니다.",
        },
        {
          icon: "📌",
          title: "팀 공지사항",
          description: "연습 안내와 예배 준비사항을 채팅과 분리해 오래 보관합니다.",
        },
        {
          icon: "🗓️",
          title: "팀 스케줄",
          description: "예배와 연습 일정을 등록하고 팀원 가능 여부를 체크합니다.",
        },
        {
          icon: "🔔",
          title: "휴대폰 알림",
          description: "새 채팅, 팀 콘티, 초대 승인 소식을 앱 안과 휴대폰 알림으로 확인합니다.",
        },
      ],
    },
    {
      eyebrow: "실험실",
      title: "팀 연습을 더 깊게 돕는 테스트 기능",
      isNew: true,
      features: [
        {
          icon: "🎛️",
          title: "팀 가이드 트랙",
          isNew: true,
          description: "악보 이미지와 송폼을 바탕으로 코드 진행, 메트로놈, 카운트인을 정리해 팀 연습용 기준 트랙을 만듭니다.",
        },
        {
          icon: "🎙️",
          title: "팀 녹음실",
          isNew: true,
          description: "가이드 트랙을 들으며 파트별로 녹음하고, 파형과 믹서, 이펙터로 팀 녹음을 함께 확인합니다.",
        },
      ],
    },
  ];

  return (
    <div className="page-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
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
              <p className="text-4xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                콘티연습실
              </p>
            </div>
            <h1 className="max-w-2xl text-2xl font-bold leading-snug text-slate-800 sm:text-3xl">
              찬양팀 콘티 준비와 연습을 더 쉽게
            </h1>
            <p className="max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
              콘티연습실은 찬양팀을 위한 콘티 작성·연습·팀 공유 도구입니다. 팀 채팅, 공지사항, 캘린더, 악보 검색, PDF 공유, 튜너와 메트로놈까지 예배 준비를 한 곳에서 관리하세요.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/setlists/new" className="btn-primary">
              새 콘티 만들기
            </Link>
            <Link href="/setlists" className="btn-secondary">
              샘플 콘티 보기
            </Link>
            {authStatus === "loading" ? null : signedIn ? (
              <Link href="/account" className="btn-secondary">
                내 계정
              </Link>
            ) : (
              <Link href="/login" className="btn-secondary">
                로그인하고 저장하기
              </Link>
            )}
            <Link href="/tools/tuner" className="btn-secondary">
              튜너 & 메트로놈 열기
            </Link>
          </div>
          <p className="max-w-xl rounded-xl border border-blue-100 bg-white/75 p-4 text-sm leading-6 text-slate-600">
            {storageMessage}
          </p>
          <div className="w-fit rounded-2xl border border-blue-100 bg-white/85 px-5 py-4 shadow-sm">
            <p className="text-sm font-bold text-slate-500">현재까지 공유된 콘티</p>
            {countStatus === "loading" ? (
              <p className="mt-2 text-lg font-black text-blue-700">집계 중</p>
            ) : countStatus === "ready" && sharedCount !== null ? (
              <p className="mt-1 text-3xl font-black text-blue-700">
                {sharedCount.toLocaleString("ko-KR")}
                <span className="ml-1 text-base font-bold text-slate-500">개</span>
              </p>
            ) : (
              <p className="mt-2 text-lg font-black text-slate-500">집계 준비 중</p>
            )}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-violet-50 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-blue-700">이번 주 콘티</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">{weeklyCardTitle}</h2>
                {weeklyCardMeta ? <p className="mt-1 text-sm font-semibold text-slate-600">{weeklyCardMeta}</p> : null}
              </div>
              {weeklyPlayHref ? (
                <Link
                  href={weeklyPlayHref}
                  className="rounded-2xl bg-white/80 px-3 py-2 text-2xl shadow-sm transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="이번 주 콘티 유튜브 전체재생 열기"
                  title="유튜브 전체재생"
                >
                  🎧
                </Link>
              ) : (
                <span className="rounded-2xl bg-white/80 px-3 py-2 text-2xl shadow-sm" aria-hidden="true">
                  🎧
                </span>
              )}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold text-slate-600">
              {weeklyTeamChatHref ? (
                <Link className="rounded-xl bg-white/80 px-2 py-2 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" href={weeklyTeamChatHref}>
                  💬 팀 채팅
                </Link>
              ) : (
                <span className="rounded-xl bg-white/80 px-2 py-2">💬 팀 채팅</span>
              )}
              {weeklyPdfHref ? (
                <Link className="rounded-xl bg-white/80 px-2 py-2 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" href={weeklyPdfHref}>
                  📄 PDF
                </Link>
              ) : (
                <span className="rounded-xl bg-white/80 px-2 py-2">📄 PDF</span>
              )}
              <span className="rounded-xl bg-white/80 px-2 py-2">🔔 알림</span>
            </div>
          </div>
          <div className="space-y-3 p-5">
            {signedIn && weeklySetlistStatus === "loading" ? (
              <div className="rounded-xl border border-slate-100 bg-white p-5 text-sm font-semibold text-slate-500">
                이번 주 팀 콘티를 불러오는 중입니다.
              </div>
            ) : realWeeklySetlist ? (
              <>
                {realWeeklySetlist.songs.length > 0 ? (
                  realWeeklySetlist.songs.map((song, index) => (
                    <WeeklySongPreview
                      key={`${realWeeklySetlist.id}-${song.title}-${index}`}
                      order={String(index + 1)}
                      title={song.title}
                      keyName={song.key || "-"}
                      bpm={song.bpm ? String(song.bpm) : "-"}
                      sections={song.sections || "곡 구성이 아직 없습니다."}
                    />
                  ))
                ) : (
                  <div className="rounded-xl border border-slate-100 bg-white p-5 text-sm font-semibold text-slate-500">
                    아직 곡이 추가되지 않았습니다.
                  </div>
                )}
                <Link href={realWeeklySetlist.href} className="btn-primary w-full justify-center">
                  콘티로
                </Link>
              </>
            ) : signedIn && weeklySetlist?.status === "empty" ? (
              <div className="rounded-xl border border-slate-100 bg-white p-5">
                <p className="font-bold text-slate-950">이번 주 콘티가 아직 없습니다.</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {weeklySetlist.teamName} 팀 콘티가 만들어지면 이곳에 바로 표시됩니다.
                </p>
                {weeklySetlist.canCreateSetlist ? (
                  <Link href={`/setlists/new?teamId=${weeklySetlist.teamId}`} className="btn-primary mt-4">
                    콘티 만들기
                  </Link>
                ) : null}
              </div>
            ) : signedIn && weeklySetlist?.status === "no_team" ? (
              <div className="rounded-xl border border-slate-100 bg-white p-5">
                <p className="font-bold text-slate-950">아직 참여 중인 팀이 없습니다.</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">팀을 만들거나 초대코드로 참여하면 이번 주 콘티를 이곳에서 확인할 수 있습니다.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/teams/new" className="btn-primary">팀 만들기</Link>
                  <Link href="/teams/join" className="btn-secondary">팀 참여하기</Link>
                </div>
              </div>
            ) : signedIn && weeklySetlistStatus === "error" ? (
              <div className="rounded-xl border border-slate-100 bg-white p-5">
                <p className="font-bold text-slate-950">이번 주 콘티를 불러오지 못했습니다.</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">팀 콘티 목록에서 직접 확인해 주세요.</p>
                <Link href="/setlists" className="btn-secondary mt-4">콘티 목록으로</Link>
              </div>
            ) : (
              demoSongs.map((song) => (
                <WeeklySongPreview
                  key={song.title}
                  order={song.order}
                  title={song.title}
                  keyName={song.keyName}
                  bpm={song.bpm}
                  sections={song.sections}
                />
              ))
            )}
          </div>
        </div>
      </section>

      <section className="space-y-7 pb-16">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black text-blue-700">기능 한눈에 보기</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              예배 준비의 자잘한 일을 한곳에 모았습니다
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-slate-600">
            리더와 팀원이 실제로 자주 쓰는 기능을 흐름별로 묶어 빠르게 찾을 수 있게 정리했습니다.
          </p>
        </div>

        {featureGroups.map((group) => (
          <div key={group.title} className="rounded-3xl border border-slate-200 bg-white/70 p-4 shadow-sm sm:p-5">
            <div className="mb-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-black text-blue-700">{group.eyebrow}</p>
                {group.isNew ? <NewBadge /> : null}
              </div>
              <h3 className="mt-1 text-xl font-black text-slate-950">{group.title}</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {group.features.map((feature) => (
                <article key={feature.title} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span
                      className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-2xl"
                      aria-hidden="true"
                    >
                      {feature.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-black text-slate-950">{feature.title}</h4>
                        {feature.isNew ? <NewBadge /> : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}

        <FaqSection />
      </section>
    </div>
  );
}

function WeeklySongPreview({
  order,
  title,
  keyName,
  bpm,
  sections,
}: {
  order: string;
  title: string;
  keyName: string;
  bpm: string;
  sections: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
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
  );
}

function NewBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-rose-600">
      NEW
    </span>
  );
}

function formatHomeDate(value: string | null) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}
