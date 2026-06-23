"use client";

import { getNaverOAuthProvider, isNaverOAuthEnabled, signInWithGoogle, signInWithNaver } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useMemo, useState } from "react";

type SocialAuthButtonsProps = {
  mode: "login" | "signup";
  redirectTo?: string;
};

type ProviderKey = "google" | "naver";

export function SocialAuthButtons({ mode, redirectTo = "/onboarding" }: SocialAuthButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<ProviderKey | null>(null);
  const [error, setError] = useState("");
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

    try {
      setError("");
      setLoadingProvider(provider);
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
        disabled={!isSupabaseConfigured() || Boolean(loadingProvider)}
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
          disabled={!isSupabaseConfigured() || !naverProvider || Boolean(loadingProvider)}
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
      {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
