"use client";

import Link from "next/link";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { sanitizeRedirectPath } from "@/lib/routes";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { signUpWithEmail } from "@/lib/auth";
import { createLegalConsentRecord, storePendingLegalConsent } from "@/lib/legalConsent";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [redirectPath, setRedirectPath] = useState("/setlists");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const requiredAgreementsAccepted = termsAgreed && privacyAgreed && ageConfirmed;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setRedirectPath(sanitizeRedirectPath(new URLSearchParams(window.location.search).get("redirect")));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!isSupabaseConfigured()) {
      setError("회원가입 기능이 아직 준비되지 않았습니다. 관리자에게 문의해 주세요.");
      return;
    }
    if (!requiredAgreementsAccepted) {
      setError("회원가입을 계속하려면 필수 약관에 동의해 주세요.");
      return;
    }

    try {
      setLoading(true);
      const legalConsent = createLegalConsentRecord();
      storePendingLegalConsent(legalConsent);
      const onboardingPath = `/onboarding?redirect=${encodeURIComponent(redirectPath)}`;
      const data = await signUpWithEmail(email, password, onboardingPath, legalConsent);
      if (data.session) {
        router.push(onboardingPath);
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
        <p className="text-sm font-bold text-blue-700">계정</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">회원가입</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          콘티연습실에서 찬양팀 콘티와 연습 자료를 함께 관리해보세요. 콘티, 곡 보관함, 팀 초대, 팀 채팅,
          알림 기능을 PC와 휴대폰에서 이어서 사용할 수 있습니다.
        </p>

        {!isSupabaseConfigured() ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            회원가입 기능이 아직 준비되지 않았습니다. 관리자 설정이 끝나면 계정 저장을 사용할 수 있습니다.
          </div>
        ) : null}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="space-y-3">
            <AgreementCheckbox
              checked={termsAgreed}
              onChange={setTermsAgreed}
              label="서비스 이용약관에 동의합니다."
              href="/terms"
            />
            <AgreementCheckbox
              checked={privacyAgreed}
              onChange={setPrivacyAgreed}
              label="개인정보 수집 및 이용에 동의합니다."
              href="/privacy"
            />
            <AgreementCheckbox
              checked={ageConfirmed}
              onChange={setAgeConfirmed}
              label="만 14세 이상입니다."
            />
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Google 또는 네이버로 가입하는 경우에도 위 필수 항목에 동의한 뒤 진행해 주세요.
          </p>
        </section>

        <div className="mt-4">
          <SocialAuthButtons
            mode="signup"
            redirectTo={`/onboarding?redirect=${encodeURIComponent(redirectPath)}`}
            disabled={!requiredAgreementsAccepted}
            disabledReason="위 필수 약관에 동의하면 소셜 계정으로 가입할 수 있습니다."
            onBeforeStart={() => storePendingLegalConsent(createLegalConsentRecord())}
          />
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

          <button type="submit" disabled={loading || !isSupabaseConfigured() || !requiredAgreementsAccepted} className="btn-primary w-full">
            {loading ? "가입 중" : "회원가입"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          이미 계정이 있나요?{" "}
          <Link href={`/login?redirect=${encodeURIComponent(redirectPath)}`} className="font-bold text-blue-700 hover:text-blue-800">
            로그인
          </Link>
        </p>

        {message ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      </section>
    </div>
  );
}

function AgreementCheckbox({
  checked,
  onChange,
  label,
  href,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  href?: string;
}) {
  return (
    <label className="flex items-start gap-3 text-sm font-semibold text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-4 accent-blue-600"
      />
      <span>
        <span className="font-black text-slate-900">[필수]</span>{" "}
        {href ? (
          <Link href={href} target="_blank" className="font-black text-blue-700 hover:text-blue-800">
            {label}
          </Link>
        ) : (
          label
        )}
      </span>
    </label>
  );
}
