import { isUserAppAdmin } from "@/lib/adminAccess";
import {
  getCharacterConfig,
  isCharacterGender,
  isCharacterInstrument,
  normalizeCharacterConfig,
  resolveCharacterImageUrl,
  type CharacterConfig,
} from "@/lib/characters/characterPresets";
import { canUseFeature } from "@/lib/features";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

type ProfileCharacterRow = {
  lab_enabled: boolean | null;
  is_admin: boolean | null;
  character_config?: unknown;
  character_gender?: string | null;
  character_instrument?: string | null;
  character_image_url?: string | null;
  character_thumbnail_url?: string | null;
  character_updated_at?: string | null;
};

type CharacterRequestBody = {
  config?: unknown;
};

export async function GET(request: Request) {
  try {
    const context = await getCharacterAccessContext(request);
    if (!context.canUseCharacterBuilder) {
      return NextResponse.json({ error: "캐릭터 선택 권한이 없습니다." }, { status: 403 });
    }

    const config = getProfileCharacterConfig(context.profile);
    return NextResponse.json({
      config,
      updatedAt: context.profile?.character_updated_at ?? null,
      hasCharacter: hasSavedCharacter(context.profile),
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
    const config = normalizeCharacterConfig(body.config);
    const now = new Date().toISOString();
    const data = await updateCharacterProfile(context, config, now);
    const savedConfig = normalizeCharacterConfig(data.character_config);
    return NextResponse.json({
      config: savedConfig,
      updatedAt: data.character_updated_at ?? now,
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
    .select("lab_enabled, is_admin, character_config, character_gender, character_instrument, character_image_url, character_thumbnail_url, character_updated_at")
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
  config: CharacterConfig,
  now: string,
) {
  const legacyImageUrl = resolveCharacterImageUrl(config.gender, config.instrument);
  const result = await context.supabase
    .from("profiles")
    .update({
      character_config: config,
      character_gender: config.gender,
      character_instrument: config.instrument,
      character_image_url: legacyImageUrl,
      character_thumbnail_url: null,
      character_updated_at: now,
    })
    .eq("id", context.user.id)
    .select("character_config, character_gender, character_instrument, character_image_url, character_thumbnail_url, character_updated_at")
    .single<ProfileCharacterRow>();

  if (!isMissingCharacterColumnError(result.error)) {
    if (result.error || !result.data) throw new CharacterApiError(result.error?.message || "캐릭터를 저장하지 못했습니다.", 500);
    return result.data;
  }

  const fallback = await context.supabase
    .from("profiles")
    .update({
      character_config: config,
      character_image_url: legacyImageUrl,
      character_updated_at: now,
    })
    .eq("id", context.user.id)
    .select("character_config, character_image_url, character_updated_at")
    .single<ProfileCharacterRow>();

  if (fallback.error || !fallback.data) throw new CharacterApiError(fallback.error?.message || "캐릭터를 저장하지 못했습니다.", 500);
  return fallback.data;
}

function getProfileCharacterConfig(profile: ProfileCharacterRow | null | undefined) {
  if (profile?.character_config) return normalizeCharacterConfig(profile.character_config);
  if (isCharacterGender(profile?.character_gender) && isCharacterInstrument(profile?.character_instrument)) {
    return getCharacterConfig(profile.character_gender, profile.character_instrument);
  }
  return normalizeCharacterConfig(null);
}

function hasSavedCharacter(profile: ProfileCharacterRow | null | undefined) {
  return Boolean(
    profile?.character_config ||
      (isCharacterGender(profile?.character_gender) && isCharacterInstrument(profile?.character_instrument)) ||
      profile?.character_image_url,
  );
}

function isMissingCharacterColumnError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42703" ||
    message.includes("character_config") ||
    message.includes("character_gender") ||
    message.includes("character_instrument") ||
    message.includes("character_thumbnail_url")
  );
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
