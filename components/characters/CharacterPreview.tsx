"use client";

import { DEFAULT_CHARACTER_CONFIG, getCharacterSummary, type CharacterConfig } from "@/lib/characters/characterPresets";
import { CharacterImage } from "./CharacterImage";

type CharacterPreviewProps = {
  character?: CharacterConfig | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function CharacterPreview({ character, size = "lg", className = "" }: CharacterPreviewProps) {
  const selectedCharacter = character ?? DEFAULT_CHARACTER_CONFIG;
  return (
    <CharacterImage
      character={selectedCharacter}
      alt={`${getCharacterSummary(selectedCharacter)} 캐릭터 미리보기`}
      size={size}
      className={className}
    />
  );
}
