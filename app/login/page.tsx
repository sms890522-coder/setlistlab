"use client";

import Link from "next/link";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { getMyProfile } from "@/lib/db/profiles";
import { sanitizeRedirectPath } from "@/lib/routes";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { signInWithEmail } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [redirectPath, setRedirectPath] = useState("/setlists");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setRedirectPath(getRedirectPath());
    const authError = new URLSearchParams(window.location.search).get("error");
    if (authError === "oauth_callback_failed") {
      setError("로그인 처리 중 문제가 발생했습니다. 다시 로그인해 주세요.");
    } else if (authError === "oauth_not_configured") {
      setError("소셜 로그인 설정이 아직 준비되지 않았습니다. 관리자에게 문의해 주세요.");
    }
  }, []);

  function getRedirectPath() {
    if (typeof window === "undefined") return "/setlists";
    return sanitizeRedirectPath(new URLSearchParams(window.location.search).get("redirect"));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!isSupabaseConfigured()) {
      setError("로그인 기능이 아직 준비되지 않았습니다. 관리자에게 문의해 주세요.");
      return;
    }

    try {
      setLoading(true);
      await signInWithEmail(email, password);
      const profile = await getMyProfile();
      router.push(isProfileReady(profile) ? redirectPath : `/onboarding?redirect=${encodeURIComponent(redirectPath)}`);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell max-w-2xl">
      <section className="card p-6 sm:p-8">
        <p className="text-sm font-bold text-blue-700">계정</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">로그인</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          로그인하면 콘티, 곡 보관함, 팀 정보, 채팅과 알림을 계정에 저장하고 PC와 휴대폰에서 이어서 사용할 수 있습니다.
        </p>

        {!isSupabaseConfigured() ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            로그인 기능이 아직 준비되지 않았습니다. 관리자 설정이 끝나면 계정 저장을 사용할 수 있습니다.
          </div>
        ) : null}

        <div className="mt-6">
          <SocialAuthButtons mode="login" redirectTo={`/onboarding?redirect=${encodeURIComponent(redirectPath)}`} />
        </div>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-black text-slate-400">또는</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1">
            <span className="field-label">이메일</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="field-input"
              type="email"
              autoComplete="email"
              placeholder="team@example.com"
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="field-label">비밀번호</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="field-input"
              type="password"
              autoComplete="current-password"
              minLength={6}
              required
            />
          </label>
          <button type="submit" disabled={loading || !isSupabaseConfigured()} className="btn-primary w-full">
            {loading ? "로그인 중" : "로그인"}
          </button>
        </form>

        <div className="mt-4 grid gap-2">
          <p className="text-center text-sm text-slate-500">
            계정이 없나요?{" "}
            <Link href={`/signup?redirect=${encodeURIComponent(redirectPath)}`} className="font-bold text-blue-700 hover:text-blue-800">
              회원가입
            </Link>
          </p>
        </div>

        {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      </section>
    </div>
  );
}

function isProfileReady(profile: Awaited<ReturnType<typeof getMyProfile>>) {
  return Boolean(profile?.role?.trim() && profile.churchName?.trim() && profile.praiseTeamName?.trim());
}
