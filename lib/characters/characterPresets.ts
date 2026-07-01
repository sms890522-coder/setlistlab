export type CharacterPresetCategory = "vocal" | "instrument" | "leader" | "casual" | "etc";

export type CharacterPreset = {
  id: string;
  name: string;
  description?: string;
  imageUrl: string;
  thumbnailUrl?: string;
  category: CharacterPresetCategory;
  recommendedPart?: string;
};

export const DEFAULT_CHARACTER_PRESET_ID = "casual_01";

export const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: "worship_leader_01",
    name: "찬양인도자",
    description: "마이크를 든 리더 캐릭터",
    imageUrl: "/characters/worship-leader-01.webp",
    category: "leader",
    recommendedPart: "leader",
  },
  {
    id: "vocalist_01",
    name: "보컬",
    description: "싱어와 보컬 팀원에게 어울리는 캐릭터",
    imageUrl: "/characters/vocalist-01.webp",
    category: "vocal",
    recommendedPart: "vocal",
  },
  {
    id: "keyboard_01",
    name: "건반",
    description: "건반 앞에 앉은 캐릭터",
    imageUrl: "/characters/keyboard-01.webp",
    category: "instrument",
    recommendedPart: "keyboard",
  },
  {
    id: "electric_guitar_01",
    name: "일렉기타",
    description: "일렉기타를 멘 캐릭터",
    imageUrl: "/characters/electric-guitar-01.webp",
    category: "instrument",
    recommendedPart: "electric_guitar",
  },
  {
    id: "acoustic_guitar_01",
    name: "어쿠스틱",
    description: "어쿠스틱 기타를 든 캐릭터",
    imageUrl: "/characters/acoustic-guitar-01.webp",
    category: "instrument",
    recommendedPart: "acoustic_guitar",
  },
  {
    id: "bass_01",
    name: "베이스",
    description: "베이스를 든 캐릭터",
    imageUrl: "/characters/bass-01.webp",
    category: "instrument",
    recommendedPart: "bass",
  },
  {
    id: "drummer_01",
    name: "드럼",
    description: "드럼 파트 캐릭터",
    imageUrl: "/characters/drummer-01.webp",
    category: "instrument",
    recommendedPart: "drums",
  },
  {
    id: "pastor_style_01",
    name: "말씀 인도",
    description: "안내와 리딩에 어울리는 차분한 캐릭터",
    imageUrl: "/characters/pastor-style-01.webp",
    category: "leader",
    recommendedPart: "leader",
  },
  {
    id: "casual_01",
    name: "캐주얼 1",
    description: "어떤 파트에도 잘 어울리는 기본 캐릭터",
    imageUrl: "/characters/casual-01.webp",
    category: "casual",
  },
  {
    id: "casual_02",
    name: "캐주얼 2",
    description: "밝은 분위기의 기본 캐릭터",
    imageUrl: "/characters/casual-02.webp",
    category: "casual",
  },
];

export function getDefaultCharacterPreset() {
  return getCharacterPresetById(DEFAULT_CHARACTER_PRESET_ID) ?? CHARACTER_PRESETS[0]!;
}

export function getCharacterPresetById(id: string | null | undefined) {
  if (!id) return null;
  return CHARACTER_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function validateCharacterPresetId(id: unknown): id is string {
  return typeof id === "string" && Boolean(getCharacterPresetById(id));
}

export function resolveCharacterPreset(id: unknown) {
  if (!validateCharacterPresetId(id)) {
    return getDefaultCharacterPreset();
  }

  return getCharacterPresetById(id) ?? getDefaultCharacterPreset();
}

export function resolveCharacterImageUrl(presetId: string) {
  return (getCharacterPresetById(presetId) ?? getDefaultCharacterPreset()).imageUrl;
}

export function getCharacterCategoryLabel(category: CharacterPresetCategory | "all") {
  const labels: Record<CharacterPresetCategory | "all", string> = {
    all: "전체",
    vocal: "보컬",
    instrument: "악기",
    leader: "리더",
    casual: "캐주얼",
    etc: "기타",
  };
  return labels[category];
}
