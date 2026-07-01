import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getCharacterSummary,
  normalizeCharacterConfig,
  type CharacterConfig,
  type CharacterGender,
  type CharacterInstrument,
} from "./characterPresets";

export type UserStageCharacter = {
  userId: string;
  displayName: string;
  role?: string;
  gender: CharacterGender;
  instrument: CharacterInstrument;
  imageUrl: string;
  summary: string;
  character: CharacterConfig;
};

type ProfileCharacterRow = {
  id: string;
  display_name: string | null;
  role: string | null;
  character_gender: string | null;
  character_instrument: string | null;
  character_image_url: string | null;
};

type TeamMemberCharacterRow = {
  user_id: string;
  position: string | null;
  status: string;
};

export async function getUserCharacter(userId: string): Promise<UserStageCharacter | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, role, character_gender, character_instrument, character_image_url")
    .eq("id", userId)
    .maybeSingle<ProfileCharacterRow>();

  if (error) throw new Error(error.message || "캐릭터 정보를 불러오지 못했습니다.");
  if (!data) return null;

  return rowToStageCharacter(data);
}

export const getUserStageCharacter = getUserCharacter;

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
    .select("id, display_name, role, character_gender, character_instrument, character_image_url")
    .in("id", userIds)
    .returns<ProfileCharacterRow[]>();
  if (profileError) throw new Error(profileError.message || "팀원 캐릭터 정보를 불러오지 못했습니다.");

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return (memberships ?? []).flatMap((row) => {
    const profile = profileById.get(row.user_id);
    if (!profile) return [];
    const character = rowToStageCharacter(profile);
    return {
      ...character,
      role: row.position || character.role,
    };
  });
}

function rowToStageCharacter(row: ProfileCharacterRow): UserStageCharacter {
  const character = normalizeCharacterConfig({
    gender: row.character_gender,
    instrument: row.character_instrument,
    imageUrl: row.character_image_url,
  });
  return {
    userId: row.id,
    displayName: row.display_name || "팀원",
    role: row.role ?? undefined,
    gender: character.gender,
    instrument: character.instrument,
    imageUrl: row.character_image_url || character.imageUrl,
    summary: getCharacterSummary(character),
    character,
  };
}

// TODO: 무대배치도에서 imageUrl을 StageCharacterNode 이미지로 렌더링하고, 드래그 배치 및 파트별 자동 추천을 연결한다.
