"use client";

import type { Provider, User } from "@supabase/supabase-js";
import type { LegalConsentRecord } from "./legalConsent";
import { sanitizeRedirectPath } from "./routes";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "./supabase/client";

export const USER_ROLES = [
  "찬양인도자",
  "싱어",
  "일렉기타",
  "어쿠스틱기타",
  "건반",
  "베이스",
  "드럼",
  "음향",
  "미디어",
  "기타",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

export async function getCurrentSession() {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session ?? null;
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(error.message || "로그인에 실패했습니다. 이메일과 비밀번호를 확인해 주세요.");
  }

  return data;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  redirectTo = "/onboarding",
  legalConsent?: LegalConsentRecord,
) {
  const supabase = getSupabaseBrowserClient();
  const safeRedirectTo = sanitizeRedirectPath(redirectTo, "/onboarding");
  const emailRedirectTo = typeof window !== "undefined" ? `${window.location.origin}${safeRedirectTo}` : undefined;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: legalConsent
        ? {
            legal_consent: legalConsent,
          }
        : undefined,
    },
  });

  if (error) {
    throw new Error(error.message || "회원가입에 실패했습니다.");
  }

  return data;
}

export async function signInWithGoogle(redirectTo = "/onboarding") {
  return signInWithOAuthProvider("google", redirectTo, "구글 로그인에 실패했습니다.");
}

export async function signInWithNaver(redirectTo = "/onboarding") {
  const provider = getNaverOAuthProvider();
  if (!provider) {
    throw new Error("네이버 로그인은 준비 중입니다.");
  }

  return signInWithOAuthProvider(provider as Provider | `custom:${string}`, redirectTo, "네이버 로그인에 실패했습니다.");
}

export function isNaverOAuthEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_NAVER_OAUTH === "true";
}

export function getNaverOAuthProvider() {
  if (!isNaverOAuthEnabled()) return "";
  return process.env.NEXT_PUBLIC_SUPABASE_NAVER_PROVIDER?.trim() || "";
}

async function signInWithOAuthProvider(provider: Provider | `custom:${string}`, redirectTo: string, fallbackMessage: string) {
  const supabase = getSupabaseBrowserClient();
  const safeRedirectTo = sanitizeRedirectPath(redirectTo, "/onboarding");
  const redirectUrl = getOAuthCallbackUrl(safeRedirectTo);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: provider as Provider,
    options: {
      redirectTo: redirectUrl,
    },
  });

  if (error) {
    throw new Error(error.message || fallbackMessage);
  }
}

function getOAuthCallbackUrl(nextPath: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const callbackUrl = new URL("/auth/callback", origin || "https://setlistlab.local");
  callbackUrl.searchParams.set("next", nextPath);
  return callbackUrl.toString();
}

export async function signOut() {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message || "로그아웃에 실패했습니다.");
  }
}
