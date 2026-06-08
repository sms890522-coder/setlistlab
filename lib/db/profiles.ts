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
  praiseTeamName?: string;
  serviceName?: string;
  sharePracticePresence: boolean;
  createdAt: string;
  updatedAt: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  role: string | null;
  custom_role: string | null;
  church_name: string | null;
  praise_team_name: string | null;
  service_name: string | null;
  share_practice_presence: boolean | null;
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
  praiseTeamName?: string;
  serviceName?: string;
  sharePracticePresence?: boolean;
}) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  const now = new Date().toISOString();
  const supabase = getSupabaseBrowserClient();
  const normalizedInput = {
    displayName: input.displayName.trim(),
    role: input.role,
    customRole: input.customRole?.trim() || null,
    churchName: input.churchName?.trim() || null,
    praiseTeamName: input.praiseTeamName?.trim() || null,
    serviceName: input.serviceName?.trim() || null,
    sharePracticePresence: input.sharePracticePresence ?? true,
  };
  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      display_name: normalizedInput.displayName,
      role: normalizedInput.role,
      custom_role: normalizedInput.customRole,
      church_name: normalizedInput.churchName,
      praise_team_name: normalizedInput.praiseTeamName,
      service_name: normalizedInput.serviceName,
      share_practice_presence: normalizedInput.sharePracticePresence,
      updated_at: now,
    })
    .select("*")
    .single<ProfileRow>();

  if (error) {
    throw new Error(error.message || "프로필을 저장하지 못했습니다.");
  }

  await syncPracticePresenceProfile(user.id, normalizedInput, now).catch(() => undefined);

  return rowToProfile(data);
}

function rowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name ?? "",
    role: row.role ?? "기타",
    customRole: row.custom_role ?? undefined,
    churchName: row.church_name ?? undefined,
    praiseTeamName: row.praise_team_name ?? undefined,
    serviceName: row.service_name ?? undefined,
    sharePracticePresence: row.share_practice_presence ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function syncPracticePresenceProfile(
  userId: string,
  input: {
    displayName: string;
    role: string;
    customRole: string | null;
    churchName: string | null;
    praiseTeamName: string | null;
    sharePracticePresence: boolean;
  },
  now: string,
) {
  const supabase = getSupabaseBrowserClient();

  if (!input.sharePracticePresence || !input.churchName || !input.praiseTeamName) {
    await supabase.from("practice_presence").delete().eq("user_id", userId);
    return;
  }

  await supabase
    .from("practice_presence")
    .update({
      display_name: input.displayName || "팀원",
      role: getPresenceProfileRole(input),
      church_name: input.churchName,
      praise_team_name: input.praiseTeamName,
      updated_at: now,
    })
    .eq("user_id", userId);
}

function getPresenceProfileRole(input: { role: string; customRole: string | null }) {
  if (input.role === "기타" && input.customRole) return input.customRole;
  return input.role || "팀원";
}
