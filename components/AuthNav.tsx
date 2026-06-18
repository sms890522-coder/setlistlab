"use client";

import Link from "next/link";
import { NotificationBell } from "@/components/NotificationBell";
import { getCurrentUser } from "@/lib/auth";
import { getMyProfile, PROFILE_UPDATED_EVENT } from "@/lib/db/profiles";
import { getApprovedMemberships } from "@/lib/db/teamMemberships";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function AuthNav() {
  const [loaded, setLoaded] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [chatHref, setChatHref] = useState("/teams");
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

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
      const memberships = await getApprovedMemberships().catch(() => []);
      setDisplayName(profile?.displayName || user.email?.split("@")[0] || "내 계정");
      setChatHref(memberships[0]?.teamId ? `/teams/${memberships[0].teamId}/chat` : "/teams");
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

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const navItems = [
    { href: "/setlists", label: "콘티" },
    { href: "/teams", label: "내 팀" },
    { href: chatHref, label: "내 팀 채팅" },
    { href: "/songs", label: "곡 보관함" },
    { href: "/tools/tuner", label: "튜너/메트로놈" },
    { href: "/settings/notifications", label: "알림 설정" },
    { href: "/contact", label: "문의/피드백" },
  ];
  const accountLabel = loaded && displayName ? displayName : "로그인";
  const accountHref = loaded && displayName ? "/account" : "/login";

  return (
    <div className="relative flex items-center gap-2">
      {loaded && displayName ? <NotificationBell /> : null}
      <button
        type="button"
        onClick={() => setMenuOpen((value) => !value)}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 text-sm font-black text-slate-800 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 md:hidden"
        aria-expanded={menuOpen}
        aria-controls="mobile-main-menu"
      >
        메뉴
        <span className="text-base leading-none" aria-hidden="true">
          {menuOpen ? "×" : "☰"}
        </span>
      </button>

      {menuOpen ? (
        <div
          id="mobile-main-menu"
          className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl md:hidden"
        >
          <div className="divide-y divide-slate-100">
            {navItems.map((item) => (
              <Link key={`${item.href}-${item.label}`} href={item.href} className={getMobileLinkClass(pathname, item.href)}>
                {item.label}
              </Link>
            ))}
            <Link href={accountHref} className="block bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700">
              {accountLabel}
            </Link>
            {!(loaded && displayName) ? (
              <Link href="/signup" className="block px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700">
                회원가입
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="hidden items-center gap-1 rounded-xl border border-slate-200 bg-white/75 p-1 shadow-sm md:flex">
        {navItems.map((item) => (
          <Link key={`${item.href}-${item.label}`} href={item.href} className={getDesktopLinkClass(pathname, item.href)}>
            {item.label}
          </Link>
        ))}
        <Link href={accountHref} className="rounded-lg bg-blue-600 px-2.5 py-2 text-sm font-bold text-white transition hover:bg-blue-700 sm:px-3">
          {accountLabel}
        </Link>
      </div>
    </div>
  );
}

function getDesktopLinkClass(pathname: string, href: string) {
  const active = isActivePath(pathname, href);
  return active
    ? "rounded-lg bg-blue-50 px-2.5 py-2 text-sm font-black text-blue-700 transition sm:px-3"
    : "rounded-lg px-2.5 py-2 text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 sm:px-3";
}

function getMobileLinkClass(pathname: string, href: string) {
  const active = isActivePath(pathname, href);
  return active
    ? "block bg-blue-50 px-4 py-3 text-sm font-black text-blue-700"
    : "block px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700";
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
