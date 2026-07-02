export type CharacterGender = "female" | "male";
export type CharacterFaceShape = "round" | "oval" | "soft_square";
export type CharacterExpression = "smile" | "calm" | "joy" | "focus";
export type CharacterHairStyle = "short" | "medium" | "long" | "wave" | "ponytail";
export type CharacterHairColor = "black" | "brown" | "dark_brown" | "light_brown";
export type CharacterTopStyle = "basic" | "hoodie" | "neat" | "worship";
export type CharacterTopColor = "black" | "white" | "blue" | "indigo" | "green" | "beige";
export type CharacterBottomColor = "black" | "navy" | "gray";

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
  faceShape: CharacterFaceShape;
  expression: CharacterExpression;
  hairStyle: CharacterHairStyle;
  hairColor: CharacterHairColor;
  topStyle: CharacterTopStyle;
  topColor: CharacterTopColor;
  bottomColor: CharacterBottomColor;
  instrument: CharacterInstrument;
};

export type CharacterLayerKey = "body" | "bottom" | "top" | "face" | "expression" | "hair" | "instrument";

export type CharacterLayer = {
  key: CharacterLayerKey;
  src: string;
  required?: boolean;
};

export const CHARACTER_GENDERS = [
  { value: "female", label: "여자" },
  { value: "male", label: "남자" },
] as const satisfies ReadonlyArray<{ value: CharacterGender; label: string }>;

export const CHARACTER_FACE_SHAPES = [
  { value: "round", label: "둥근 얼굴" },
  { value: "oval", label: "타원형 얼굴" },
  { value: "soft_square", label: "부드러운 사각형" },
] as const satisfies ReadonlyArray<{ value: CharacterFaceShape; label: string }>;

export const CHARACTER_EXPRESSIONS = [
  { value: "smile", label: "웃는 표정" },
  { value: "calm", label: "차분한 표정" },
  { value: "joy", label: "기쁜 표정" },
  { value: "focus", label: "집중하는 표정" },
] as const satisfies ReadonlyArray<{ value: CharacterExpression; label: string }>;

export const CHARACTER_HAIR_STYLES = [
  { value: "short", label: "짧은 머리" },
  { value: "medium", label: "중간 머리" },
  { value: "long", label: "긴 머리" },
  { value: "wave", label: "웨이브" },
  { value: "ponytail", label: "포니테일" },
] as const satisfies ReadonlyArray<{ value: CharacterHairStyle; label: string }>;

export const CHARACTER_HAIR_COLORS = [
  { value: "black", label: "블랙", color: "#111827" },
  { value: "brown", label: "브라운", color: "#8B5E34" },
  { value: "dark_brown", label: "다크브라운", color: "#4B2E1F" },
  { value: "light_brown", label: "밝은 브라운", color: "#B77945" },
] as const satisfies ReadonlyArray<{ value: CharacterHairColor; label: string; color: string }>;

export const CHARACTER_TOP_STYLES = [
  { value: "basic", label: "기본 티셔츠" },
  { value: "hoodie", label: "후드" },
  { value: "neat", label: "단정한 상의" },
  { value: "worship", label: "찬양팀 의상" },
] as const satisfies ReadonlyArray<{ value: CharacterTopStyle; label: string }>;

export const CHARACTER_TOP_COLORS = [
  { value: "black", label: "블랙", color: "#111827" },
  { value: "white", label: "화이트", color: "#F8FAFC" },
  { value: "blue", label: "블루", color: "#2563EB" },
  { value: "indigo", label: "인디고", color: "#4F46E5" },
  { value: "green", label: "그린", color: "#059669" },
  { value: "beige", label: "베이지", color: "#D8B384" },
] as const satisfies ReadonlyArray<{ value: CharacterTopColor; label: string; color: string }>;

export const CHARACTER_BOTTOM_COLORS = [
  { value: "black", label: "블랙", color: "#111827" },
  { value: "navy", label: "네이비", color: "#1E3A8A" },
  { value: "gray", label: "그레이", color: "#64748B" },
] as const satisfies ReadonlyArray<{ value: CharacterBottomColor; label: string; color: string }>;

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
  faceShape: "round",
  expression: "smile",
  hairStyle: "medium",
  hairColor: "black",
  topStyle: "basic",
  topColor: "indigo",
  bottomColor: "black",
  instrument: "none",
};

export function getDefaultCharacterConfig(): CharacterConfig {
  return { ...DEFAULT_CHARACTER_CONFIG };
}

export function isCharacterGender(value: unknown): value is CharacterGender {
  return isOneOf(value, CHARACTER_GENDERS);
}

export function isCharacterFaceShape(value: unknown): value is CharacterFaceShape {
  return isOneOf(value, CHARACTER_FACE_SHAPES);
}

export function isCharacterExpression(value: unknown): value is CharacterExpression {
  return isOneOf(value, CHARACTER_EXPRESSIONS);
}

export function isCharacterHairStyle(value: unknown): value is CharacterHairStyle {
  return isOneOf(value, CHARACTER_HAIR_STYLES);
}

export function isCharacterHairColor(value: unknown): value is CharacterHairColor {
  return isOneOf(value, CHARACTER_HAIR_COLORS);
}

export function isCharacterTopStyle(value: unknown): value is CharacterTopStyle {
  return isOneOf(value, CHARACTER_TOP_STYLES);
}

export function isCharacterTopColor(value: unknown): value is CharacterTopColor {
  return isOneOf(value, CHARACTER_TOP_COLORS);
}

export function isCharacterBottomColor(value: unknown): value is CharacterBottomColor {
  return isOneOf(value, CHARACTER_BOTTOM_COLORS);
}

export function isCharacterInstrument(value: unknown): value is CharacterInstrument {
  return isOneOf(value, CHARACTER_INSTRUMENTS);
}

export function normalizeCharacterConfig(input: unknown): CharacterConfig {
  const record = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  return {
    version: 1,
    gender: isCharacterGender(record.gender) ? record.gender : DEFAULT_CHARACTER_CONFIG.gender,
    faceShape: isCharacterFaceShape(record.faceShape) ? record.faceShape : DEFAULT_CHARACTER_CONFIG.faceShape,
    expression: isCharacterExpression(record.expression) ? record.expression : DEFAULT_CHARACTER_CONFIG.expression,
    hairStyle: isCharacterHairStyle(record.hairStyle) ? record.hairStyle : DEFAULT_CHARACTER_CONFIG.hairStyle,
    hairColor: isCharacterHairColor(record.hairColor) ? record.hairColor : DEFAULT_CHARACTER_CONFIG.hairColor,
    topStyle: isCharacterTopStyle(record.topStyle) ? record.topStyle : DEFAULT_CHARACTER_CONFIG.topStyle,
    topColor: isCharacterTopColor(record.topColor) ? record.topColor : DEFAULT_CHARACTER_CONFIG.topColor,
    bottomColor: isCharacterBottomColor(record.bottomColor) ? record.bottomColor : DEFAULT_CHARACTER_CONFIG.bottomColor,
    instrument: isCharacterInstrument(record.instrument) ? record.instrument : DEFAULT_CHARACTER_CONFIG.instrument,
  };
}

export function getCharacterConfig(gender: CharacterGender, instrument: CharacterInstrument): CharacterConfig {
  return normalizeCharacterConfig({ ...DEFAULT_CHARACTER_CONFIG, gender, instrument });
}

export function resolveCharacterImageUrl(gender: CharacterGender, instrument: CharacterInstrument): string {
  return `/characters/${gender}-${instrument.replaceAll("_", "-")}.webp`;
}

export function getCharacterLayers(configInput: unknown): CharacterLayer[] {
  const config = normalizeCharacterConfig(configInput);
  const instrumentPath = config.instrument === "none" ? "none" : config.instrument.replaceAll("_", "-");
  return [
    { key: "body", src: `/characters/layers/base/${config.gender}-body-01.webp`, required: true },
    { key: "bottom", src: `/characters/layers/outfit-bottom/bottom-basic-01-${config.bottomColor}.webp` },
    { key: "top", src: `/characters/layers/outfit-top/top-${config.topStyle}-01-${config.topColor}.webp` },
    { key: "hair", src: `/characters/layers/hair/${config.gender}-${config.hairStyle}-01-${config.hairColor.replaceAll("_", "-")}.webp` },
    { key: "face", src: `/characters/layers/face/face-${config.faceShape.replaceAll("_", "-")}-01.webp`, required: true },
    { key: "expression", src: `/characters/layers/expression/${config.expression}-01.webp`, required: true },
    { key: "instrument", src: `/characters/layers/instrument/${instrumentPath}.webp` },
  ];
}

export function getCharacterGenderLabel(gender: CharacterGender) {
  return CHARACTER_GENDERS.find((item) => item.value === gender)?.label ?? "여자";
}

export function getCharacterFaceShapeLabel(faceShape: CharacterFaceShape) {
  return CHARACTER_FACE_SHAPES.find((item) => item.value === faceShape)?.label ?? "둥근 얼굴";
}

export function getCharacterExpressionLabel(expression: CharacterExpression) {
  return CHARACTER_EXPRESSIONS.find((item) => item.value === expression)?.label ?? "웃는 표정";
}

export function getCharacterHairStyleLabel(hairStyle: CharacterHairStyle) {
  return CHARACTER_HAIR_STYLES.find((item) => item.value === hairStyle)?.label ?? "중간 머리";
}

export function getCharacterHairColorLabel(hairColor: CharacterHairColor) {
  return CHARACTER_HAIR_COLORS.find((item) => item.value === hairColor)?.label ?? "블랙";
}

export function getCharacterTopStyleLabel(topStyle: CharacterTopStyle) {
  return CHARACTER_TOP_STYLES.find((item) => item.value === topStyle)?.label ?? "기본 티셔츠";
}

export function getCharacterTopColorLabel(topColor: CharacterTopColor) {
  return CHARACTER_TOP_COLORS.find((item) => item.value === topColor)?.label ?? "인디고";
}

export function getCharacterBottomColorLabel(bottomColor: CharacterBottomColor) {
  return CHARACTER_BOTTOM_COLORS.find((item) => item.value === bottomColor)?.label ?? "블랙";
}

export function getCharacterInstrumentLabel(instrument: CharacterInstrument) {
  return CHARACTER_INSTRUMENTS.find((item) => item.value === instrument)?.label ?? "없음";
}

export function getCharacterSummary(configInput: unknown) {
  const config = normalizeCharacterConfig(configInput);
  return `${getCharacterGenderLabel(config.gender)} · ${getCharacterHairStyleLabel(config.hairStyle)} · ${getCharacterExpressionLabel(config.expression)} · ${getCharacterInstrumentLabel(config.instrument)}`;
}

function isOneOf<T extends string>(value: unknown, list: ReadonlyArray<{ value: T }>): value is T {
  return typeof value === "string" && list.some((item) => item.value === value);
}
