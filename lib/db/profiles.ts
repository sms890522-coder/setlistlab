"use client";

import type { UserRole } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type Profile = {
  id: string;
  displayName: string;
  role: UserRole | "기타" | string;
  customRole?: string;
  churchName?: string;
  serviceName?: string;
  createdAt: string;
  updatedAt: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  role: string | null;
  custom_role: string | null;
  church_name: string | null;
  service_name: string | null;
  created_at: string;
  updated_at: string;
};

export async function getMyProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  return getProfile(user.id);
}

export async function getProfile(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle<ProfileRow>();

  if (error) {
    throw new Error(error.message || "프로필을 불러오지 못했습니다.");
  }

  return data ? rowToProfile(data) : null;
}

export async function upsertMyProfile(input: {
  displayName: string;
  role: string;
  customRole?: string;
  churchName?: string;
  serviceName?: string;
}) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  const now = new Date().toISOString();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      display_name: input.displayName.trim(),
      role: input.role,
      custom_role: input.customRole?.trim() || null,
      church_name: input.churchName?.trim() || null,
      service_name: input.serviceName?.trim() || null,
      updated_at: now,
    })
    .select("*")
    .single<ProfileRow>();

  if (error) {
    throw new Error(error.message || "프로필을 저장하지 못했습니다.");
  }

  return rowToProfile(data);
}

function rowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name ?? "",
    role: row.role ?? "기타",
    customRole: row.custom_role ?? undefined,
    churchName: row.church_name ?? undefined,
    serviceName: row.service_name ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
