"use client";

import Link from "next/link";
import { getMyProfile } from "@/lib/db/profiles";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { signInWithEmail, signInWithGoogle } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function getRedirectPath() {
    if (typeof window === "undefined") return "/setlists";
    return new URLSearchParams(window.location.search).get("redirect") || "/setlists";
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
      router.push(profile ? getRedirectPath() : `/onboarding?redirect=${encodeURIComponent(getRedirectPath())}`);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    try {
      setError("");
      await signInWithGoogle(`/onboarding?redirect=${encodeURIComponent(getRedirectPath())}`);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "구글 로그인에 실패했습니다.");
    }
  }

  return (
    <div className="page-shell max-w-2xl">
      <section className="card p-6 sm:p-8">
        <p className="text-sm font-bold text-blue-700">계정</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">로그인</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          로그인하면 콘티, 곡 보관함, 팀원 목록을 계정 클라우드에 저장해서 다른 기기에서도 이어서 볼 수 있습니다.
        </p>

        {!isSupabaseConfigured() ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            로그인 기능이 아직 준비되지 않았습니다. 관리자 설정이 끝나면 계정 저장을 사용할 수 있습니다.
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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

        <div className="mt-3 grid gap-2">
          <button type="button" onClick={handleGoogleLogin} disabled={!isSupabaseConfigured()} className="btn-secondary w-full">
            구글로 계속하기
          </button>
          <p className="text-center text-sm text-slate-500">
            계정이 없나요?{" "}
            <Link href="/signup" className="font-bold text-blue-700 hover:text-blue-800">
              회원가입
            </Link>
          </p>
        </div>

        {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      </section>
    </div>
  );
}
