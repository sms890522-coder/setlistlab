import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getDefaultCharacterConfig, normalizeCharacterConfig, type StageCharacterConfig } from "./characterConfig";

export type UserStageCharacter = {
  userId: string;
  displayName: string;
  role?: string;
  characterConfig: StageCharacterConfig;
};

type ProfileCharacterRow = {
  id: string;
  display_name: string | null;
  role: string | null;
  character_config: unknown | null;
};

type TeamMemberCharacterRow = {
  user_id: string;
  position: string | null;
  status: string;
};

export async function getUserStageCharacter(userId: string): Promise<UserStageCharacter | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, role, character_config")
    .eq("id", userId)
    .maybeSingle<ProfileCharacterRow>();

  if (error) throw new Error(error.message || "캐릭터 정보를 불러오지 못했습니다.");
  if (!data) return null;

  return {
    userId: data.id,
    displayName: data.display_name || "팀원",
    role: data.role ?? undefined,
    characterConfig: normalizeCharacterConfig(data.character_config ?? getDefaultCharacterConfig()),
  };
}

export async function getTeamMembersWithCharacters(teamId: string): Promise<UserStageCharacter[]> {
  const supabase = getSupabaseBrowserClient();
  const { data: memberships, error } = await supabase
    .from("team_memberships")
    .select("user_id, position, status")
    .eq("team_id", teamId)
    .eq("status", "approved")
    .returns<TeamMemberCharacterRow[]>();

  if (error) throw new Error(error.message || "팀원 캐릭터 정보를 불러오지 못했습니다.");
  const userIds = Array.from(new Set((memberships ?? []).map((row) => row.user_id).filter(Boolean)));
  if (userIds.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, role, character_config")
    .in("id", userIds)
    .returns<ProfileCharacterRow[]>();
  if (profileError) throw new Error(profileError.message || "팀원 캐릭터 정보를 불러오지 못했습니다.");

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return (memberships ?? []).flatMap((row) => {
    const profile = profileById.get(row.user_id);
    if (!profile) return [];

    return {
      userId: row.user_id,
      displayName: profile.display_name || "팀원",
      role: row.position || profile.role || undefined,
      characterConfig: normalizeCharacterConfig(profile.character_config ?? getDefaultCharacterConfig()),
    };
  });
}

// TODO: 무대배치도에서 이 유틸을 사용해 팀원 캐릭터를 StageCharacterNode로 렌더링하고 드래그 배치를 연결한다.
