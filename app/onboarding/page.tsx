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
  const [praiseTeamName, setPraiseTeamName] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [sharePracticePresence, setSharePracticePresence] = useState(true);
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
      if (profile?.role?.trim() && profile.churchName?.trim() && profile.praiseTeamName?.trim()) {
        router.replace(getRedirectPath());
        return;
      }

      setDisplayName(profile?.displayName || user.email?.split("@")[0] || "");
      setRole(profile?.role || "찬양인도자");
      setCustomRole(profile?.customRole || "");
      setChurchName(profile?.churchName || "");
      setPraiseTeamName(profile?.praiseTeamName || "");
      setServiceName(profile?.serviceName || "");
      setSharePracticePresence(profile?.sharePracticePresence ?? true);
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
      await upsertMyProfile({ displayName, role, customRole, churchName, praiseTeamName, serviceName, sharePracticePresence });
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
        <p className="text-sm font-bold text-blue-700">처음 설정</p>
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
              <input value={churchName} onChange={(event) => setChurchName(event.target.value)} className="field-input" required />
            </label>
            <label className="space-y-1">
              <span className="field-label">찬양팀 이름</span>
              <input
                value={praiseTeamName}
                onChange={(event) => setPraiseTeamName(event.target.value)}
                className="field-input"
                placeholder="예: 주일 2부 찬양팀"
                required
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
                  내가 속한 승인된 팀의 팀원에게 어떤 곡을 연습 중인지 보여줍니다. 기본값은 공유입니다.
                </span>
              </span>
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
