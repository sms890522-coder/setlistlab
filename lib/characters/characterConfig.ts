import { getDefaultCharacterPreset, resolveCharacterPreset } from "./characterPresets";

export {
  CHARACTER_PRESETS,
  DEFAULT_CHARACTER_PRESET_ID,
  getCharacterCategoryLabel,
  getCharacterPresetById,
  getDefaultCharacterPreset,
  resolveCharacterImageUrl,
  resolveCharacterPreset,
  validateCharacterPresetId,
  type CharacterPreset,
  type CharacterPresetCategory,
} from "./characterPresets";

export type StageCharacterConfig = {
  version: 2;
  presetId: string;
  imageUrl: string;
};

export function getDefaultCharacterConfig(): StageCharacterConfig {
  const preset = getDefaultCharacterPreset();
  return {
    version: 2,
    presetId: preset.id,
    imageUrl: preset.imageUrl,
  };
}

export function normalizeCharacterConfig(input: unknown): StageCharacterConfig {
  const presetId = isRecord(input) && typeof input.presetId === "string" ? input.presetId : undefined;
  const preset = resolveCharacterPreset(presetId);
  return {
    version: 2,
    presetId: preset.id,
    imageUrl: preset.imageUrl,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
