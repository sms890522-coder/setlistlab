export type CharacterGender = "female" | "male";

export type CharacterInstrument =
  | "none"
  | "vocal"
  | "keyboard"
  | "electric_guitar"
  | "acoustic_guitar"
  | "bass"
  | "drums"
  | "cajon"
  | "leader"
  | "in_ear"
  | "engineer"
  | "broadcast_room";

export type CharacterConfig = {
  version: 1;
  gender: CharacterGender;
  instrument: CharacterInstrument;
  imageUrl: string;
};

export const CHARACTER_GENDERS = [
  { value: "female", label: "여자" },
  { value: "male", label: "남자" },
] as const satisfies ReadonlyArray<{ value: CharacterGender; label: string }>;

export const CHARACTER_INSTRUMENTS = [
  { value: "none", label: "없음" },
  { value: "vocal", label: "보컬/마이크" },
  { value: "keyboard", label: "건반" },
  { value: "electric_guitar", label: "일렉기타" },
  { value: "acoustic_guitar", label: "어쿠스틱기타" },
  { value: "bass", label: "베이스" },
  { value: "drums", label: "드럼" },
  { value: "cajon", label: "카혼" },
  { value: "leader", label: "리더" },
  { value: "in_ear", label: "인이어" },
  { value: "engineer", label: "엔지니어" },
  { value: "broadcast_room", label: "방송실" },
] as const satisfies ReadonlyArray<{ value: CharacterInstrument; label: string }>;

export const DEFAULT_CHARACTER_CONFIG: CharacterConfig = {
  version: 1,
  gender: "female",
  instrument: "none",
  imageUrl: "/characters/female-none.webp",
};

export function resolveCharacterImageUrl(gender: CharacterGender, instrument: CharacterInstrument): string {
  return `/characters/${gender}-${instrument.replaceAll("_", "-")}.webp`;
}

export function getCharacterConfig(gender: CharacterGender, instrument: CharacterInstrument): CharacterConfig {
  return {
    version: 1,
    gender,
    instrument,
    imageUrl: resolveCharacterImageUrl(gender, instrument),
  };
}

export function getDefaultCharacterConfig(): CharacterConfig {
  return DEFAULT_CHARACTER_CONFIG;
}

export function isCharacterGender(value: unknown): value is CharacterGender {
  return typeof value === "string" && CHARACTER_GENDERS.some((item) => item.value === value);
}

export function isCharacterInstrument(value: unknown): value is CharacterInstrument {
  return typeof value === "string" && CHARACTER_INSTRUMENTS.some((item) => item.value === value);
}

export function normalizeCharacterConfig(input: {
  gender?: unknown;
  instrument?: unknown;
  imageUrl?: unknown;
} | null | undefined): CharacterConfig {
  const gender = isCharacterGender(input?.gender) ? input.gender : DEFAULT_CHARACTER_CONFIG.gender;
  const instrument = isCharacterInstrument(input?.instrument) ? input.instrument : DEFAULT_CHARACTER_CONFIG.instrument;
  return getCharacterConfig(gender, instrument);
}

export function getCharacterGenderLabel(gender: CharacterGender) {
  return CHARACTER_GENDERS.find((item) => item.value === gender)?.label ?? "여자";
}

export function getCharacterInstrumentLabel(instrument: CharacterInstrument) {
  return CHARACTER_INSTRUMENTS.find((item) => item.value === instrument)?.label ?? "없음";
}

export function getCharacterSummary(config: Pick<CharacterConfig, "gender" | "instrument">) {
  return `${getCharacterGenderLabel(config.gender)} · ${getCharacterInstrumentLabel(config.instrument)}`;
}
