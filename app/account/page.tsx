"use client";

import Link from "next/link";
import { USER_ROLES, getCurrentUser, signOut } from "@/lib/auth";
import { getCloudSetlists } from "@/lib/db/setlists";
import { getCloudSongLibrary } from "@/lib/db/savedSongs";
import { getMyProfile, upsertMyProfile } from "@/lib/db/profiles";
import { getTeamMembers } from "@/lib/db/teamMembers";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export default function AccountPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("기타");
  const [customRole, setCustomRole] = useState("");
  const [churchName, setChurchName] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [stats, setStats] = useState({ setlists: 0, songs: 0, teamMembers: 0 });
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

      const [profile, cloudSetlists, cloudSongs, teamMembers] = await Promise.all([
        getMyProfile(),
        getCloudSetlists().catch(() => []),
        getCloudSongLibrary().catch(() => []),
        getTeamMembers().catch(() => []),
      ]);
      setEmail(user.email ?? "");
      setDisplayName(profile?.displayName || user.email?.split("@")[0] || "");
      setRole(profile?.role || "기타");
      setCustomRole(profile?.customRole || "");
      setChurchName(profile?.churchName || "");
      setServiceName(profile?.serviceName || "");
      setStats({ setlists: cloudSetlists.length, songs: cloudSongs.length, teamMembers: teamMembers.length });
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
      await upsertMyProfile({ displayName, role, customRole, churchName, serviceName });
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
            <h2 className="section-title">프로필</h2>
            <p className="mt-1 text-sm text-slate-500">{email}</p>
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
                <span className="field-label">기본 예배 이름</span>
                <input value={serviceName} onChange={(event) => setServiceName(event.target.value)} className="field-input" />
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
