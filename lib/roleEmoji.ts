const ROLE_EMOJI_RULES: Array<[RegExp, string]> = [
  [/인도|리더|찬양인도/, "🎤"],
  [/싱어|보컬/, "🎙️"],
  [/일렉|전기/, "🎸"],
  [/어쿠|어쿠스틱|통기타/, "🪕"],
  [/건반|피아노|키보드|세컨/, "🎹"],
  [/베이스/, "🎸"],
  [/드럼|퍼커션/, "🥁"],
  [/음향|사운드|엔지니어/, "🎚️"],
  [/자막|가사/, "📝"],
  [/방송|영상|카메라|미디어/, "🎥"],
];

export function getRoleEmoji(role?: string) {
  const normalizedRole = (role ?? "").trim();
  if (!normalizedRole) return "✨";

  return ROLE_EMOJI_RULES.find(([pattern]) => pattern.test(normalizedRole))?.[1] ?? "✨";
}

export function formatMemberNameWithEmoji(role: string | undefined, name: string | undefined) {
  return `${getRoleEmoji(role)} ${name?.trim() || "이름 미정"}`;
}
