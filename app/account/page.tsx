"use client";

import Link from "next/link";
import { USER_ROLES, getCurrentUser, signOut } from "@/lib/auth";
import { AVAILABILITY_LABELS, getMyUpcomingTeamEvents, type TeamCalendarEventWithAvailability } from "@/lib/db/teamCalendar";
import { getCloudSetlists } from "@/lib/db/setlists";
import { getCloudSongLibrary } from "@/lib/db/savedSongs";
import { getMyProfile, upsertMyProfile } from "@/lib/db/profiles";
import { getTeamMembers } from "@/lib/db/teamMembers";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export default function AccountPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [authProviderMessage, setAuthProviderMessage] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("기타");
  const [customRole, setCustomRole] = useState("");
  const [churchName, setChurchName] = useState("");
  const [praiseTeamName, setPraiseTeamName] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [sharePracticePresence, setSharePracticePresence] = useState(true);
  const [labEnabled, setLabEnabled] = useState(false);
  const [stats, setStats] = useState({ setlists: 0, songs: 0, teamMembers: 0 });
  const [upcomingEvents, setUpcomingEvents] = useState<TeamCalendarEventWithAvailability[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadAccount() {
      if (!isSupabaseConfigured()) {
        setLoaded(true);
        return;
      }

      const user = await getCurrentUser();
      if (!user) {
        router.replace("/login?redirect=/account");
        return;
      }

      const [profile, cloudSetlists, cloudSongs, teamMembers, teamEvents] = await Promise.all([
        getMyProfile(),
        getCloudSetlists().catch(() => []),
        getCloudSongLibrary().catch(() => []),
        getTeamMembers().catch(() => []),
        getMyUpcomingTeamEvents().catch(() => []),
      ]);
      setEmail(user.email ?? "");
      setAuthProviderMessage(getAuthProviderMessage(user));
      setDisplayName(profile?.displayName || user.email?.split("@")[0] || "");
      setRole(profile?.role || "기타");
      setCustomRole(profile?.customRole || "");
      setChurchName(profile?.churchName || "");
      setPraiseTeamName(profile?.praiseTeamName || "");
      setServiceName(profile?.serviceName || "");
      setSharePracticePresence(profile?.sharePracticePresence ?? true);
      setLabEnabled(profile?.labEnabled ?? false);
      setStats({ setlists: cloudSetlists.length, songs: cloudSongs.length, teamMembers: teamMembers.length });
      setUpcomingEvents(teamEvents);
      setLoaded(true);
    }

    loadAccount().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "계정 정보를 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      await upsertMyProfile({ displayName, role, customRole, churchName, praiseTeamName, serviceName, sharePracticePresence, labEnabled });
      setMessage("프로필을 저장했습니다.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "프로필을 저장하지 못했습니다.");
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      router.push("/");
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "로그아웃에 실패했습니다.");
    }
  }

  return (
    <div className="page-shell space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-blue-700">계정</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">내 계정</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">로그인 저장소와 찬양팀 기본 정보를 관리합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/team" className="btn-secondary">
            팀원 관리
          </Link>
          <Link href="/songs" className="btn-secondary">
            곡 보관함
          </Link>
          <button type="button" onClick={handleSignOut} className="btn-danger">
            로그아웃
          </button>
        </div>
      </section>

      {!loaded ? (
        <div className="card p-8 text-sm text-slate-500">계정 정보를 불러오는 중입니다.</div>
      ) : !isSupabaseConfigured() ? (
        <section className="card p-6">
          <h2 className="text-xl font-black text-slate-950">로그인 기능 준비가 필요합니다</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            계정 저장을 사용하려면 관리자 설정이 먼저 필요합니다.
          </p>
        </section>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            {[
              ["저장된 콘티", stats.setlists],
              ["곡 보관함", stats.songs],
              ["팀원", stats.teamMembers],
            ].map(([label, value]) => (
              <div key={label} className="card p-5">
                <p className="text-sm font-bold text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-black text-blue-700">{value}</p>
              </div>
            ))}
          </section>

          <section className="card p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="section-title">내 팀 일정</h2>
                <p className="mt-1 text-sm text-slate-500">다가오는 예배와 연습 일정, 내 가능 여부를 확인할 수 있습니다.</p>
              </div>
              <Link href="/teams" className="btn-secondary min-h-10 px-3">내 팀</Link>
            </div>

            {upcomingEvents.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                다가오는 팀 일정이 없습니다.
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {upcomingEvents.map((event) => (
                  <div key={event.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-bold text-blue-700">{event.teamLabel || "팀 일정"}</p>
                        <h3 className="mt-1 font-black text-slate-950">{event.title}</h3>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          {formatEventDate(event.eventDate)}
                          {event.startTime ? ` · ${event.startTime}` : ""}
                        </p>
                      </div>
                      <span className={availabilityBadgeClass(event.myAvailability?.status ?? "unknown")}>
                        내 응답: {AVAILABILITY_LABELS[event.myAvailability?.status ?? "unknown"]}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={`/teams/${event.teamId}/calendar/${event.id}`} className="btn-secondary min-h-10 px-3">변경하기</Link>
                      {event.setlist ? <Link href={`/setlists/${event.setlist.id}`} className="btn-secondary min-h-10 px-3">콘티 보기</Link> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card p-6">
            <h2 className="section-title">프로필</h2>
            <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-950">{email || "이메일 정보가 없습니다."}</p>
              {authProviderMessage ? <p className="mt-1 text-xs font-semibold text-slate-500">{authProviderMessage}</p> : null}
            </div>
            <form onSubmit={handleSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 sm:col-span-2">
                <span className="field-label">이름</span>
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="field-input" required />
              </label>
              <label className="space-y-1">
                <span className="field-label">역할</span>
                <select value={role} onChange={(event) => setRole(event.target.value)} className="field-input">
                  {USER_ROLES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="field-label">기타 역할</span>
                <input value={customRole} onChange={(event) => setCustomRole(event.target.value)} className="field-input" />
              </label>
              <label className="space-y-1">
                <span className="field-label">교회 이름</span>
                <input value={churchName} onChange={(event) => setChurchName(event.target.value)} className="field-input" />
              </label>
              <label className="space-y-1">
                <span className="field-label">찬양팀 이름</span>
                <input
                  value={praiseTeamName}
                  onChange={(event) => setPraiseTeamName(event.target.value)}
                  className="field-input"
                  placeholder="예: 주일 2부 찬양팀"
                />
                <span className="field-help">교회 이름과 찬양팀 이름은 표시용입니다. 실제 팀은 초대코드로 참여하고 리더가 승인한 기준으로 구분됩니다.</span>
              </label>
              <label className="space-y-1">
                <span className="field-label">기본 예배 이름</span>
                <input value={serviceName} onChange={(event) => setServiceName(event.target.value)} className="field-input" />
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50/60 p-4 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={sharePracticePresence}
                  onChange={(event) => setSharePracticePresence(event.target.checked)}
                  className="mt-1 size-4 accent-blue-600"
                />
                <span>
                  <span className="block text-sm font-bold text-blue-950">연습중 표시 공유</span>
                  <span className="mt-1 block text-xs leading-5 text-blue-800">
                    내가 속한 승인된 팀의 팀원에게 어떤 곡을 연습 중인지 보여줍니다.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-violet-100 bg-violet-50/70 p-4 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={labEnabled}
                  onChange={(event) => setLabEnabled(event.target.checked)}
                  className="mt-1 size-4 accent-violet-600"
                />
                <span>
                  <span className="block text-sm font-bold text-violet-950">실험실 기능 사용</span>
                  <span className="mt-1 block text-xs leading-5 text-violet-800">
                    아직 테스트 중인 새로운 기능을 먼저 사용해볼 수 있습니다. 실험실을 켜면 팀 가이드 트랙 만들기 같은 기능을 사용할 수 있습니다.
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-violet-700">
                    실험실 기능은 변경되거나 일시적으로 동작하지 않을 수 있으니 중요한 작업 전에는 기존 기능도 함께 확인해 주세요.
                  </span>
                </span>
              </label>
              <button type="submit" className="btn-primary sm:col-span-2">
                저장
              </button>
            </form>
            {message ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
            {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
          </section>
        </>
      )}
    </div>
  );
}

function getAuthProviderMessage(user: User) {
  const providers = getAuthProviders(user);

  if (providers.some((provider) => provider.includes("google"))) {
    return "구글로 가입한 계정이에요.";
  }

  if (providers.some((provider) => provider.includes("naver"))) {
    return "네이버로 가입한 계정이에요.";
  }

  if (providers.some((provider) => provider.includes("email"))) {
    return "이메일로 가입한 계정이에요.";
  }

  return "";
}

function getAuthProviders(user: User) {
  const providers = [
    user.app_metadata?.provider,
    user.user_metadata?.provider,
    ...(Array.isArray(user.identities) ? user.identities.map((identity) => identity.provider) : []),
  ];

  return providers.filter((provider): provider is string => typeof provider === "string" && Boolean(provider.trim())).map((provider) => provider.trim().toLowerCase());
}

function formatEventDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function availabilityBadgeClass(status: "available" | "unavailable" | "maybe" | "unknown") {
  const classes = {
    available: "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700",
    unavailable: "rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-700",
    maybe: "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700",
    unknown: "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600",
  };
  return classes[status];
}
