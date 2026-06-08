"use client";

import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getMyProfile, PROFILE_UPDATED_EVENT } from "@/lib/db/profiles";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export function AuthNav() {
  const [loaded, setLoaded] = useState(false);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    async function loadAuth() {
      if (!isSupabaseConfigured()) {
        setLoaded(true);
        return;
      }

      const user = await getCurrentUser();
      if (!user) {
        setDisplayName("");
        setLoaded(true);
        return;
      }

      const profile = await getMyProfile().catch(() => null);
      setDisplayName(profile?.displayName || user.email?.split("@")[0] || "내 계정");
      setLoaded(true);
    }

    function refreshAuth() {
      loadAuth();
    }

    refreshAuth();
    window.addEventListener(PROFILE_UPDATED_EVENT, refreshAuth);

    if (!isSupabaseConfigured()) {
      return () => {
        window.removeEventListener(PROFILE_UPDATED_EVENT, refreshAuth);
      };
    }

    const supabase = getSupabaseBrowserClient();
    const { data } = supabase.auth.onAuthStateChange(() => {
      loadAuth();
    });

    return () => {
      window.removeEventListener(PROFILE_UPDATED_EVENT, refreshAuth);
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white/75 p-1 shadow-sm">
      <Link
        href="/setlists"
        className="rounded-lg px-2.5 py-2 text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 sm:px-3"
      >
        콘티
      </Link>
      <Link
        href="/songs"
        className="rounded-lg px-2.5 py-2 text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 sm:px-3"
      >
        곡
      </Link>
      <Link
        href="/team"
        className="hidden rounded-lg px-2.5 py-2 text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 sm:block sm:px-3"
      >
        팀
      </Link>
      <Link
        href="/tools/tuner"
        className="rounded-lg px-2.5 py-2 text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 sm:px-3"
      >
        튜너
      </Link>
      {loaded && displayName ? (
        <Link
          href="/account"
          className="rounded-lg bg-blue-600 px-2.5 py-2 text-sm font-bold text-white transition hover:bg-blue-700 sm:px-3"
        >
          {displayName}
        </Link>
      ) : (
        <Link
          href="/login"
          className="rounded-lg bg-blue-600 px-2.5 py-2 text-sm font-bold text-white transition hover:bg-blue-700 sm:px-3"
        >
          로그인
        </Link>
      )}
    </div>
  );
}
