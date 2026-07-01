import type { CharacterConfig } from "./characterPresets";

export {
  CHARACTER_GENDERS,
  CHARACTER_INSTRUMENTS,
  DEFAULT_CHARACTER_CONFIG,
  getCharacterConfig,
  getCharacterGenderLabel,
  getCharacterInstrumentLabel,
  getCharacterSummary,
  getDefaultCharacterConfig,
  isCharacterGender,
  isCharacterInstrument,
  normalizeCharacterConfig,
  resolveCharacterImageUrl,
  type CharacterConfig,
  type CharacterGender,
  type CharacterInstrument,
} from "./characterPresets";

export type StageCharacterConfig = CharacterConfig;
