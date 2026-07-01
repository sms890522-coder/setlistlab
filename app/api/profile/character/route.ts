import { isUserAppAdmin } from "@/lib/adminAccess";
import {
  getCharacterConfig,
  isCharacterGender,
  isCharacterInstrument,
  normalizeCharacterConfig,
  type CharacterGender,
  type CharacterInstrument,
} from "@/lib/characters/characterPresets";
import { canUseFeature } from "@/lib/features";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

type ProfileCharacterRow = {
  lab_enabled: boolean | null;
  is_admin: boolean | null;
  character_config?: unknown;
  character_gender: string | null;
  character_instrument: string | null;
  character_image_url: string | null;
  character_updated_at: string | null;
};

type CharacterRequestBody = {
  gender?: unknown;
  instrument?: unknown;
};

export async function GET(request: Request) {
  try {
    const context = await getCharacterAccessContext(request);
    if (!context.canUseCharacterBuilder) {
      return NextResponse.json({ error: "캐릭터 선택 권한이 없습니다." }, { status: 403 });
    }

    const legacyCharacter = getLegacyCharacterConfig(context.profile);
    const character = normalizeCharacterConfig({
      gender: context.profile?.character_gender ?? legacyCharacter?.gender,
      instrument: context.profile?.character_instrument ?? legacyCharacter?.instrument,
      imageUrl: context.profile?.character_image_url,
    });
    return NextResponse.json({
      ...character,
      updatedAt: context.profile?.character_updated_at ?? null,
      hasCharacter: Boolean((context.profile?.character_gender && context.profile?.character_instrument) || legacyCharacter),
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
      return NextResponse.json({ error: "캐릭터 선택 권한이 없습니다." }, { status: 403 });
    }

    const body = (await request.json()) as CharacterRequestBody;
    if (!isCharacterGender(body.gender) || !isCharacterInstrument(body.instrument)) {
      return NextResponse.json({ error: "지원하지 않는 캐릭터 설정입니다." }, { status: 400 });
    }

    const character = getCharacterConfig(body.gender, body.instrument);
    const now = new Date().toISOString();
    const data = await updateCharacterProfile(context, character, now);
    const savedCharacter = normalizeCharacterConfig(data);
    return NextResponse.json({
      ...savedCharacter,
      updatedAt: data.updatedAt,
      hasCharacter: true,
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
    .select("lab_enabled, is_admin, character_config, character_gender, character_instrument, character_image_url, character_updated_at")
    .eq("id", user.id)
    .maybeSingle<ProfileCharacterRow>();
  let resolvedProfile = profile;
  if (isMissingCharacterColumnError(profileError)) {
    const fallback = await supabase
      .from("profiles")
      .select("lab_enabled, is_admin, character_config, character_image_url, character_updated_at")
      .eq("id", user.id)
      .maybeSingle<ProfileCharacterRow>();
    if (fallback.error) throw new CharacterApiError(fallback.error.message || "프로필 권한을 확인하지 못했습니다.", 500);
    resolvedProfile = fallback.data;
  } else if (profileError) {
    throw new CharacterApiError(profileError.message || "프로필 권한을 확인하지 못했습니다.", 500);
  }

  const featureProfile = {
    labEnabled: resolvedProfile?.lab_enabled ?? false,
    isAdmin: Boolean(resolvedProfile?.is_admin) || isUserAppAdmin(user),
  };

  return {
    supabase,
    user,
    profile: resolvedProfile,
    canUseCharacterBuilder: canUseFeature(featureProfile, "profileCharacterBuilder"),
  };
}

async function updateCharacterProfile(
  context: Awaited<ReturnType<typeof getCharacterAccessContext>>,
  character: ReturnType<typeof getCharacterConfig>,
  now: string,
) {
  const result = await context.supabase
    .from("profiles")
    .update({
      character_config: character,
      character_gender: character.gender,
      character_instrument: character.instrument,
      character_image_url: character.imageUrl,
      character_updated_at: now,
    })
    .eq("id", context.user.id)
    .select("character_config, character_gender, character_instrument, character_image_url, character_updated_at")
    .single<ProfileCharacterRow>();

  if (!isMissingCharacterColumnError(result.error)) {
    if (result.error || !result.data) throw new CharacterApiError(result.error?.message || "캐릭터를 저장하지 못했습니다.", 500);
    return {
      gender: result.data.character_gender ?? getLegacyCharacterConfig(result.data)?.gender,
      instrument: result.data.character_instrument ?? getLegacyCharacterConfig(result.data)?.instrument,
      imageUrl: result.data.character_image_url,
      updatedAt: result.data.character_updated_at,
    };
  }

  const fallback = await context.supabase
    .from("profiles")
    .update({
      character_config: character,
      character_image_url: character.imageUrl,
      character_updated_at: now,
    })
    .eq("id", context.user.id)
    .select("character_config, character_image_url, character_updated_at")
    .single<ProfileCharacterRow>();

  if (fallback.error || !fallback.data) throw new CharacterApiError(fallback.error?.message || "캐릭터를 저장하지 못했습니다.", 500);
  const legacyCharacter = getLegacyCharacterConfig(fallback.data);
  return {
    gender: legacyCharacter?.gender,
    instrument: legacyCharacter?.instrument,
    imageUrl: fallback.data.character_image_url,
    updatedAt: fallback.data.character_updated_at,
  };
}

function getLegacyCharacterConfig(profile: Pick<ProfileCharacterRow, "character_config"> | null | undefined) {
  const value = profile?.character_config;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!isCharacterGender(record.gender) || !isCharacterInstrument(record.instrument)) return null;
  return getCharacterConfig(record.gender, record.instrument);
}

function isMissingCharacterColumnError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "42703" || message.includes("character_gender") || message.includes("character_instrument");
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
