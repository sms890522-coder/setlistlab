"use client";

import { detectInAppBrowser } from "@/lib/browser/inAppBrowser";
import { getNaverOAuthProvider, isNaverOAuthEnabled, signInWithGoogle, signInWithNaver } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createPortal } from "react-dom";
import { useMemo, useState } from "react";

type SocialAuthButtonsProps = {
  mode: "login" | "signup";
  redirectTo?: string;
  disabled?: boolean;
  disabledReason?: string;
  onBeforeStart?: () => void;
};

type ProviderKey = "google" | "naver";

export function SocialAuthButtons({
  mode,
  redirectTo = "/onboarding",
  disabled = false,
  disabledReason,
  onBeforeStart,
}: SocialAuthButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<ProviderKey | null>(null);
  const [error, setError] = useState("");
  const [inAppBrowserModalOpen, setInAppBrowserModalOpen] = useState(false);
  const naverEnabled = isNaverOAuthEnabled();
  const naverProvider = getNaverOAuthProvider();
  const labels = useMemo(
    () => ({
      google: mode === "signup" ? "Google로 가입" : "Google로 계속",
      naver: mode === "signup" ? "네이버로 가입" : "네이버로 계속",
    }),
    [mode],
  );

  async function handleSocialAuth(provider: ProviderKey) {
    if (!isSupabaseConfigured()) {
      setError("소셜 로그인이 아직 준비되지 않았습니다. 관리자에게 문의해 주세요.");
      return;
    }
    if (disabled) {
      setError(disabledReason || "필수 동의 후 계속할 수 있습니다.");
      return;
    }
    if (provider === "google" && detectInAppBrowser().isInAppBrowser) {
      setError("");
      setInAppBrowserModalOpen(true);
      return;
    }

    try {
      setError("");
      setLoadingProvider(provider);
      onBeforeStart?.();
      if (provider === "google") {
        await signInWithGoogle(redirectTo);
      } else {
        await signInWithNaver(redirectTo);
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "소셜 로그인을 시작하지 못했습니다. 다시 시도해 주세요.");
      setLoadingProvider(null);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => handleSocialAuth("google")}
        disabled={!isSupabaseConfigured() || disabled || Boolean(loadingProvider)}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={labels.google}
      >
        <span aria-hidden="true" className="grid size-6 place-items-center rounded-full border border-slate-200 bg-white text-sm font-black text-blue-600">
          G
        </span>
        {loadingProvider === "google" ? "Google 연결 중..." : labels.google}
      </button>

      {naverEnabled ? (
        <button
          type="button"
          onClick={() => handleSocialAuth("naver")}
          disabled={!isSupabaseConfigured() || disabled || !naverProvider || Boolean(loadingProvider)}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500 bg-[#03C75A] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={labels.naver}
          title={naverProvider ? labels.naver : "네이버 로그인은 준비 중입니다."}
        >
          <span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-white text-sm font-black text-[#03C75A]">
            N
          </span>
          {loadingProvider === "naver" ? "네이버 연결 중..." : labels.naver}
        </button>
      ) : null}

      {naverEnabled && !naverProvider ? (
        <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">네이버 로그인은 준비 중입니다.</p>
      ) : null}
      {disabled && disabledReason ? (
        <p className="rounded-xl bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-600">{disabledReason}</p>
      ) : null}
      {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      {inAppBrowserModalOpen ? <InAppBrowserGoogleNoticeModal onClose={() => setInAppBrowserModalOpen(false)} /> : null}
    </div>
  );
}

function InAppBrowserGoogleNoticeModal({ onClose }: { onClose: () => void }) {
  const [copyMessage, setCopyMessage] = useState("");

  async function copyCurrentUrl() {
    const url = typeof window !== "undefined" ? window.location.href : "https://setlistlab.vercel.app/";
    try {
      await navigator.clipboard.writeText(url);
      setCopyMessage("주소를 복사했습니다. Safari 또는 Chrome 주소창에 붙여넣어 주세요.");
    } catch {
      fallbackCopy(url);
      setCopyMessage("주소를 복사했습니다. Safari 또는 Chrome 주소창에 붙여넣어 주세요.");
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-950/45 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="flex min-h-full items-center justify-center px-4 py-6">
        <section className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-blue-50 text-xl" aria-hidden="true">
              G
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-black text-slate-950">브라우저에서 다시 열어주세요</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                Google 로그인은 보안 정책상 앱 내부 브라우저에서 사용할 수 없습니다. Safari 또는 Chrome에서 콘티연습실을 열어주세요.
              </p>
            </div>
          </div>

          {copyMessage ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{copyMessage}</p> : null}

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => void copyCurrentUrl()} className="btn-primary">
              주소 복사하기
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              닫기
            </button>
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}

function fallbackCopy(value: string) {
  if (typeof document === "undefined") return;
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}
