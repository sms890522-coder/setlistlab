"use client";

import type { User } from "@supabase/supabase-js";
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

export async function signUpWithEmail(email: string, password: string) {
  const supabase = getSupabaseBrowserClient();
  const emailRedirectTo = typeof window !== "undefined" ? `${window.location.origin}/onboarding` : undefined;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });

  if (error) {
    throw new Error(error.message || "회원가입에 실패했습니다.");
  }

  return data;
}

export async function signInWithGoogle(redirectTo = "/onboarding") {
  const supabase = getSupabaseBrowserClient();
  const redirectOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const safeRedirectTo = sanitizeRedirectPath(redirectTo, "/onboarding");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${redirectOrigin}${safeRedirectTo}`,
    },
  });

  if (error) {
    throw new Error(error.message || "구글 로그인에 실패했습니다.");
  }
}

export async function signOut() {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message || "로그아웃에 실패했습니다.");
  }
}
