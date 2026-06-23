"use client";

import { ensureUserProfile } from "@/lib/db/profiles";
import { sanitizeRedirectPath } from "@/lib/routes";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("로그인 정보를 확인하는 중입니다.");

  useEffect(() => {
    async function handleCallback() {
      if (!isSupabaseConfigured()) {
        router.replace("/login?error=oauth_not_configured");
        return;
      }

      const searchParams = new URLSearchParams(window.location.search);
      const nextPath = sanitizeRedirectPath(searchParams.get("next"), "/onboarding");
      const code = searchParams.get("code");
      const oauthError = searchParams.get("error");

      if (oauthError) {
        router.replace(`/login?error=oauth_callback_failed&redirect=${encodeURIComponent(nextPath)}`);
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();

        if (code) {
          setMessage("소셜 로그인 세션을 준비하는 중입니다.");
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          await ensureUserProfile(data.user);
        } else {
          const {
            data: { session },
            error,
          } = await supabase.auth.getSession();
          if (error) throw error;
          if (!session?.user) throw new Error("로그인 세션을 찾을 수 없습니다.");
          await ensureUserProfile(session.user);
        }

        router.replace(nextPath);
      } catch {
        router.replace(`/login?error=oauth_callback_failed&redirect=${encodeURIComponent(nextPath)}`);
      }
    }

    handleCallback();
  }, [router]);

  return (
    <div className="page-shell max-w-2xl">
      <section className="card p-8 text-center">
        <p className="text-sm font-bold text-blue-700">계정</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">로그인 처리 중</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
      </section>
    </div>
  );
}
