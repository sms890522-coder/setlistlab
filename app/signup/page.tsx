"use client";

import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { signUpWithEmail } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!isSupabaseConfigured()) {
      setError("Supabase 환경변수가 설정되어 있지 않습니다.");
      return;
    }

    try {
      setLoading(true);
      const data = await signUpWithEmail(email, password);
      if (data.session) {
        router.push("/onboarding");
        return;
      }
      setMessage("가입 확인 메일을 보냈습니다. 이메일 인증 후 로그인해 주세요.");
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : "회원가입에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell max-w-2xl">
      <section className="card p-6 sm:p-8">
        <p className="text-sm font-bold text-blue-700">Account</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">회원가입</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          찬양팀 콘티와 곡 보관함을 계정에 저장하려면 이메일 계정을 만들어 주세요.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block space-y-1">
            <span className="field-label">이메일</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="field-input"
              type="email"
              autoComplete="email"
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
              autoComplete="new-password"
              minLength={6}
              required
            />
            <span className="field-help">6자 이상으로 입력해 주세요.</span>
          </label>
          <button type="submit" disabled={loading || !isSupabaseConfigured()} className="btn-primary w-full">
            {loading ? "가입 중" : "회원가입"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          이미 계정이 있나요?{" "}
          <Link href="/login" className="font-bold text-blue-700 hover:text-blue-800">
            로그인
          </Link>
        </p>

        {message ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      </section>
    </div>
  );
}
