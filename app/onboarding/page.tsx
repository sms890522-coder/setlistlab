"use client";

import { USER_ROLES, getCurrentUser } from "@/lib/auth";
import { getMyProfile, upsertMyProfile } from "@/lib/db/profiles";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export default function OnboardingPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("찬양인도자");
  const [customRole, setCustomRole] = useState("");
  const [churchName, setChurchName] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      if (!isSupabaseConfigured()) {
        setLoaded(true);
        return;
      }

      const user = await getCurrentUser();
      if (!user) {
        router.replace("/login?redirect=/onboarding");
        return;
      }

      const profile = await getMyProfile();
      setDisplayName(profile?.displayName || user.email?.split("@")[0] || "");
      setRole(profile?.role || "찬양인도자");
      setCustomRole(profile?.customRole || "");
      setChurchName(profile?.churchName || "");
      setServiceName(profile?.serviceName || "");
      setLoaded(true);
    }

    loadProfile().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "프로필을 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, [router]);

  function getRedirectPath() {
    if (typeof window === "undefined") return "/setlists";
    return new URLSearchParams(window.location.search).get("redirect") || "/setlists";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      setSaving(true);
      await upsertMyProfile({ displayName, role, customRole, churchName, serviceName });
      router.push(getRedirectPath());
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "프로필을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-shell max-w-3xl">
      <section className="card p-6 sm:p-8">
        <p className="text-sm font-bold text-blue-700">Welcome</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">처음 설정</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          콘티와 팀원 관리에 표시될 기본 정보를 입력해 주세요. 나중에 계정 화면에서 수정할 수 있습니다.
        </p>

        {!loaded ? (
          <p className="mt-6 text-sm text-slate-500">프로필을 불러오는 중입니다.</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
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
              <input
                value={customRole}
                onChange={(event) => setCustomRole(event.target.value)}
                className="field-input"
                placeholder="예: 팀장, 예배기획"
              />
            </label>
            <label className="space-y-1">
              <span className="field-label">교회 이름</span>
              <input value={churchName} onChange={(event) => setChurchName(event.target.value)} className="field-input" />
            </label>
            <label className="space-y-1">
              <span className="field-label">기본 예배 이름</span>
              <input value={serviceName} onChange={(event) => setServiceName(event.target.value)} className="field-input" />
            </label>
            <button type="submit" disabled={saving} className="btn-primary sm:col-span-2">
              {saving ? "저장 중" : "시작하기"}
            </button>
          </form>
        )}

        {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      </section>
    </div>
  );
}
