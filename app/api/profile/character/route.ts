import { isUserAppAdmin } from "@/lib/adminAccess";
import { getDefaultCharacterConfig, normalizeCharacterConfig } from "@/lib/characters/characterConfig";
import { canUseFeature } from "@/lib/features";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

type ProfileCharacterRow = {
  lab_enabled: boolean | null;
  is_admin: boolean | null;
  character_config: unknown | null;
  character_updated_at: string | null;
};

type CharacterRequestBody = {
  characterConfig?: unknown;
};

export async function GET(request: Request) {
  try {
    const context = await getCharacterAccessContext(request);
    if (!context.canUseCharacterBuilder) {
      return NextResponse.json({ error: "캐릭터 만들기 권한이 없습니다." }, { status: 403 });
    }

    return NextResponse.json({
      characterConfig: normalizeCharacterConfig(context.profile?.character_config ?? getDefaultCharacterConfig()),
      updatedAt: context.profile?.character_updated_at ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "캐릭터 정보를 불러오지 못했습니다." },
      { status: getErrorStatus(error) },
    );
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCharacterAccessContext(request);
    if (!context.canUseCharacterBuilder) {
      return NextResponse.json({ error: "캐릭터 만들기 권한이 없습니다." }, { status: 403 });
    }

    const body = (await request.json()) as CharacterRequestBody;
    const characterConfig = normalizeCharacterConfig(body.characterConfig);
    const now = new Date().toISOString();
    const { data, error } = await context.supabase
      .from("profiles")
      .update({
        character_config: characterConfig,
        character_updated_at: now,
      })
      .eq("id", context.user.id)
      .select("character_config, character_updated_at")
      .single<{ character_config: unknown | null; character_updated_at: string | null }>();

    if (error || !data) {
      throw new CharacterApiError(error?.message || "캐릭터를 저장하지 못했습니다.", 500);
    }

    return NextResponse.json({
      characterConfig: normalizeCharacterConfig(data.character_config),
      updatedAt: data.character_updated_at,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "캐릭터를 저장하지 못했습니다." },
      { status: getErrorStatus(error) },
    );
  }
}

async function getCharacterAccessContext(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new CharacterApiError("로그인이 필요합니다.", 401);

  const supabase = getSupabaseAdminClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !user) throw new CharacterApiError("로그인이 필요합니다.", 401);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("lab_enabled, is_admin, character_config, character_updated_at")
    .eq("id", user.id)
    .maybeSingle<ProfileCharacterRow>();
  if (profileError) throw new CharacterApiError(profileError.message || "프로필 권한을 확인하지 못했습니다.", 500);

  const featureProfile = {
    labEnabled: profile?.lab_enabled ?? false,
    isAdmin: Boolean(profile?.is_admin) || isUserAppAdmin(user),
  };

  return {
    supabase,
    user,
    profile,
    canUseCharacterBuilder: canUseFeature(featureProfile, "profileCharacterBuilder"),
  };
}

class CharacterApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getErrorStatus(error: unknown) {
  return error instanceof CharacterApiError ? error.status : 500;
}
