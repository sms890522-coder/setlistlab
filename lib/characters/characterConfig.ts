export const CHARACTER_STYLES = ["round", "soft", "simple"] as const;
export const CHARACTER_FACE_SHAPES = ["circle", "oval", "square_round"] as const;
export const CHARACTER_SKIN_TONES = ["light", "medium", "warm", "deep"] as const;
export const CHARACTER_HAIR_STYLES = ["short", "medium", "long", "curly", "cap", "none"] as const;
export const CHARACTER_HAIR_COLORS = ["black", "brown", "dark_brown", "blonde"] as const;
export const CHARACTER_EXPRESSIONS = ["smile", "calm", "joy", "focus"] as const;
export const CHARACTER_ITEMS = [
  "none",
  "mic",
  "keyboard",
  "electric_guitar",
  "acoustic_guitar",
  "bass",
  "drumsticks",
  "cajon",
  "in_ear",
  "leader",
] as const;

export const CHARACTER_COLOR_PALETTE = [
  "#6366F1",
  "#2563EB",
  "#10B981",
  "#8B5CF6",
  "#E11D48",
  "#F59E0B",
  "#334155",
] as const;

export const CHARACTER_BACKGROUND_PALETTE = [
  "#EEF2FF",
  "#DBEAFE",
  "#D1FAE5",
  "#F3E8FF",
  "#FFE4E6",
  "#FEF3C7",
  "#F1F5F9",
] as const;

export type CharacterStyle = (typeof CHARACTER_STYLES)[number];
export type CharacterFaceShape = (typeof CHARACTER_FACE_SHAPES)[number];
export type CharacterSkinTone = (typeof CHARACTER_SKIN_TONES)[number];
export type CharacterHairStyle = (typeof CHARACTER_HAIR_STYLES)[number];
export type CharacterHairColor = (typeof CHARACTER_HAIR_COLORS)[number];
export type CharacterExpression = (typeof CHARACTER_EXPRESSIONS)[number];
export type CharacterItem = (typeof CHARACTER_ITEMS)[number];

export type StageCharacterConfig = {
  version: 1;
  style: CharacterStyle;
  faceShape: CharacterFaceShape;
  skinTone: CharacterSkinTone;
  hairStyle: CharacterHairStyle;
  hairColor: CharacterHairColor;
  topColor: string;
  bottomColor: string;
  expression: CharacterExpression;
  item: CharacterItem;
  backgroundColor?: string;
};

export const DEFAULT_STAGE_CHARACTER_CONFIG: StageCharacterConfig = {
  version: 1,
  style: "round",
  faceShape: "circle",
  skinTone: "light",
  hairStyle: "short",
  hairColor: "black",
  topColor: "#6366F1",
  bottomColor: "#334155",
  expression: "smile",
  item: "none",
  backgroundColor: "#EEF2FF",
};

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export function getDefaultCharacterConfig(): StageCharacterConfig {
  return { ...DEFAULT_STAGE_CHARACTER_CONFIG };
}

export function mergeCharacterConfig(savedConfig: unknown): StageCharacterConfig {
  return normalizeCharacterConfig(savedConfig);
}

export function validateCharacterConfig(input: unknown): input is StageCharacterConfig {
  try {
    normalizeCharacterConfig(input);
    return true;
  } catch {
    return false;
  }
}

export function normalizeCharacterConfig(input: unknown): StageCharacterConfig {
  const source = isRecord(input) ? input : {};
  const defaults = DEFAULT_STAGE_CHARACTER_CONFIG;

  return {
    version: 1,
    style: pickAllowed(source.style, CHARACTER_STYLES, defaults.style),
    faceShape: pickAllowed(source.faceShape, CHARACTER_FACE_SHAPES, defaults.faceShape),
    skinTone: pickAllowed(source.skinTone, CHARACTER_SKIN_TONES, defaults.skinTone),
    hairStyle: pickAllowed(source.hairStyle, CHARACTER_HAIR_STYLES, defaults.hairStyle),
    hairColor: pickAllowed(source.hairColor, CHARACTER_HAIR_COLORS, defaults.hairColor),
    topColor: normalizeColor(source.topColor, defaults.topColor),
    bottomColor: normalizeColor(source.bottomColor, defaults.bottomColor),
    expression: pickAllowed(source.expression, CHARACTER_EXPRESSIONS, defaults.expression),
    item: pickAllowed(source.item, CHARACTER_ITEMS, defaults.item),
    backgroundColor: normalizeColor(source.backgroundColor, defaults.backgroundColor ?? "#EEF2FF"),
  };
}

export function getCharacterItemLabel(item: CharacterItem) {
  const labels: Record<CharacterItem, string> = {
    none: "없음",
    mic: "마이크",
    keyboard: "건반",
    electric_guitar: "일렉",
    acoustic_guitar: "어쿠스틱",
    bass: "베이스",
    drumsticks: "드럼스틱",
    cajon: "카혼",
    in_ear: "인이어",
    leader: "리더",
  };
  return labels[item];
}

function pickAllowed<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

function normalizeColor(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!HEX_COLOR_PATTERN.test(trimmed)) return fallback;
  return trimmed.toUpperCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
