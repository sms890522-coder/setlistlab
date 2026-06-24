"use client";

import type { User } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/auth";
import { getCurrentSession, getCurrentUser } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export const PROFILE_UPDATED_EVENT = "conti-practice-room:profile-updated";

export type Profile = {
  id: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole | "기타" | string;
  customRole?: string;
  churchName?: string;
  praiseTeamName?: string;
  serviceName?: string;
  sharePracticePresence: boolean;
  labEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
  custom_role: string | null;
  church_name: string | null;
  praise_team_name: string | null;
  service_name: string | null;
  share_practice_presence: boolean | null;
  lab_enabled: boolean | null;
  created_at: string;
  updated_at: string;
};

const PROFILE_SELECT =
  "id, display_name, avatar_url, role, custom_role, church_name, praise_team_name, service_name, share_practice_presence, lab_enabled, created_at, updated_at";
const PROFILE_SELECT_LEGACY =
  "id, display_name, avatar_url, role, custom_role, church_name, praise_team_name, service_name, share_practice_presence, created_at, updated_at";

export async function getMyProfile() {
  const user = await getProfileUser();
  if (!user) return null;

  return getProfile(user.id);
}

export async function getProfile(userId: string) {
  const supabase = getSupabaseBrowserClient();
  let { data, error } = await supabase.from("profiles").select(PROFILE_SELECT).eq("id", userId).maybeSingle<ProfileRow>();

  if (isMissingProfileMetadataColumnError(error)) {
    const legacyResult = await supabase.from("profiles").select(PROFILE_SELECT_LEGACY).eq("id", userId).maybeSingle<ProfileRow>();
    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error) {
    throw new Error(error.message || "프로필을 불러오지 못했습니다.");
  }

  return data ? rowToProfile(data) : null;
}

export async function ensureUserProfile(user?: User | null) {
  const currentUser = user ?? (await getProfileUser());
  if (!currentUser) return null;

  const existingProfile = await getProfile(currentUser.id).catch(() => null);
  const email = inferProfileEmail(currentUser) || null;
  const displayName = existingProfile?.displayName?.trim() || inferProfileDisplayName(currentUser);
  const avatarUrl = existingProfile?.avatarUrl?.trim() || inferProfileAvatarUrl(currentUser) || null;
  const role = existingProfile?.role?.trim() || "기타";
  const now = new Date().toISOString();

  const { data, error } = await upsertProfileRow({
    id: currentUser.id,
    email,
    display_name: displayName,
    avatar_url: avatarUrl,
    role,
    custom_role: existingProfile?.customRole ?? null,
    church_name: existingProfile?.churchName ?? null,
    praise_team_name: existingProfile?.praiseTeamName ?? null,
    service_name: existingProfile?.serviceName ?? null,
    share_practice_presence: existingProfile?.sharePracticePresence ?? true,
    lab_enabled: existingProfile?.labEnabled ?? false,
    updated_at: now,
  });

  if (error) {
    throw new Error(error.message || "프로필을 준비하지 못했습니다.");
  }

  return rowToProfile(data);
}

export async function upsertMyProfile(input: {
  displayName: string;
  role: string;
  customRole?: string;
  churchName?: string;
  praiseTeamName?: string;
  serviceName?: string;
  sharePracticePresence?: boolean;
  labEnabled?: boolean;
}) {
  const user = await getProfileUser();
  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  const now = new Date().toISOString();
  const existingProfile = await getProfile(user.id).catch(() => null);
  const normalizedInput = {
    displayName: input.displayName.trim(),
    role: input.role,
    customRole: input.customRole?.trim() || null,
    churchName: input.churchName?.trim() || null,
    praiseTeamName: input.praiseTeamName?.trim() || null,
    serviceName: input.serviceName?.trim() || null,
    sharePracticePresence: input.sharePracticePresence ?? true,
    labEnabled: input.labEnabled ?? existingProfile?.labEnabled ?? false,
  };
  const { data, error } = await upsertProfileRow({
    id: user.id,
    email: inferProfileEmail(user) || null,
    display_name: normalizedInput.displayName,
    avatar_url: existingProfile?.avatarUrl?.trim() || inferProfileAvatarUrl(user) || null,
    role: normalizedInput.role,
    custom_role: normalizedInput.customRole,
    church_name: normalizedInput.churchName,
    praise_team_name: normalizedInput.praiseTeamName,
    service_name: normalizedInput.serviceName,
    share_practice_presence: normalizedInput.sharePracticePresence,
    lab_enabled: normalizedInput.labEnabled,
    updated_at: now,
  });

  if (error) {
    throw new Error(error.message || "프로필을 저장하지 못했습니다.");
  }

  await syncPracticePresenceProfile(user.id, normalizedInput, now).catch(() => undefined);

  const profile = rowToProfile(data);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: profile }));
  }

  return profile;
}

export function inferProfileDisplayName(user: User) {
  const metadata = user.user_metadata ?? {};
  const candidates = [
    metadata.display_name,
    metadata.full_name,
    metadata.name,
    metadata.nickname,
    metadata.user_name,
    metadata.preferred_username,
    metadata.email,
    user.email,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return user.email?.split("@")[0] || "팀원";
}

function inferProfileEmail(user: User) {
  const metadata = user.user_metadata ?? {};
  const candidate = typeof metadata.email === "string" && metadata.email.trim() ? metadata.email.trim() : user.email?.trim();
  return candidate || "";
}

function inferProfileAvatarUrl(user: User) {
  const metadata = user.user_metadata ?? {};
  const candidates = [metadata.avatar_url, metadata.picture, metadata.profile_image];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
}

async function getProfileUser() {
  const session = await getCurrentSession();
  if (session?.user) return session.user;
  return getCurrentUser();
}

function rowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name ?? "",
    avatarUrl: row.avatar_url ?? undefined,
    role: row.role ?? "기타",
    customRole: row.custom_role ?? undefined,
    churchName: row.church_name ?? undefined,
    praiseTeamName: row.praise_team_name ?? undefined,
    serviceName: row.service_name ?? undefined,
    sharePracticePresence: row.share_practice_presence ?? true,
    labEnabled: row.lab_enabled ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function upsertProfileRow(row: {
  id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  role: string;
  custom_role: string | null;
  church_name: string | null;
  praise_team_name: string | null;
  service_name: string | null;
  share_practice_presence: boolean;
  lab_enabled: boolean;
  updated_at: string;
}) {
  const supabase = getSupabaseBrowserClient();
  const result = await supabase.from("profiles").upsert(row).select(PROFILE_SELECT).single<ProfileRow>();

  if (!isMissingProfileMetadataColumnError(result.error)) {
    return result;
  }

  const { email: _email, avatar_url: _avatarUrl, lab_enabled: _labEnabled, ...legacyRow } = row;
  return supabase.from("profiles").upsert(legacyRow).select(PROFILE_SELECT_LEGACY).single<ProfileRow>();
}

function isMissingProfileMetadataColumnError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "42703" || message.includes("email") || message.includes("avatar_url") || message.includes("lab_enabled");
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
