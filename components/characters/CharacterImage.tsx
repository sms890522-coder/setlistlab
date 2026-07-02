"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_CHARACTER_CONFIG,
  resolveCharacterImageUrl,
  type CharacterConfig,
  type CharacterExpression,
  type CharacterFaceShape,
  type CharacterHairColor,
  type CharacterHairStyle,
  type CharacterTopStyle,
  type CharacterBottomColor,
  type CharacterTopColor,
} from "@/lib/characters/characterPresets";

type CharacterImageProps = {
  character?: CharacterConfig | null;
  alt: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASSES = {
  sm: "size-16 rounded-2xl",
  md: "size-32 rounded-[1.75rem]",
  lg: "size-56 rounded-[2rem]",
};

export function CharacterImage({ character, alt, size = "lg", className = "" }: CharacterImageProps) {
  const selectedCharacter = character ?? DEFAULT_CHARACTER_CONFIG;
  const imageUrl = resolveCharacterImageUrl(selectedCharacter.gender, selectedCharacter.instrument);
  const defaultImageUrl = resolveCharacterImageUrl(DEFAULT_CHARACTER_CONFIG.gender, DEFAULT_CHARACTER_CONFIG.instrument);
  const [currentSrc, setCurrentSrc] = useState(imageUrl);
  const [failedDefault, setFailedDefault] = useState(false);

  useEffect(() => {
    setCurrentSrc(imageUrl);
    setFailedDefault(false);
  }, [imageUrl]);

  return (
    <div
      className={`relative inline-flex ${SIZE_CLASSES[size]} items-center justify-center overflow-hidden border border-white/80 bg-gradient-to-br from-indigo-50 via-white to-rose-50 shadow-sm ${className}`}
      role="img"
      aria-label={alt}
    >
      {!failedDefault ? (
        <div className="relative h-full w-full">
          <img
            src={currentSrc}
            alt=""
            className="h-full w-full object-contain p-3"
            draggable={false}
            loading="lazy"
            onError={() => {
              if (currentSrc !== defaultImageUrl) {
                setCurrentSrc(defaultImageUrl);
                return;
              }
              setFailedDefault(true);
            }}
          />
          <CharacterCustomizationOverlay character={selectedCharacter} />
        </div>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-indigo-50 to-blue-50 p-4 text-center">
          <span className={size === "sm" ? "text-2xl" : size === "md" ? "text-5xl" : "text-7xl"} aria-hidden="true">
            🙂
          </span>
          {size !== "sm" ? (
            <>
              <p className="text-sm font-black text-slate-800">내 캐릭터</p>
              <p className="text-xs font-semibold text-slate-500">이미지 준비 중</p>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

function CharacterCustomizationOverlay({ character }: { character: CharacterConfig }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <HairAccent color={character.hairColor} style={character.hairStyle} />
      <FaceAccent faceShape={character.faceShape} expression={character.expression} />
      <OutfitAccent color={character.topColor} style={character.topStyle} />
      <BottomAccent color={character.bottomColor} />
    </div>
  );
}

function HairAccent({ color, style }: { color: CharacterHairColor; style: CharacterHairStyle }) {
  const sizeClass =
    style === "long" || style === "wave"
      ? "left-[27%] top-[7%] h-[28%] w-[46%]"
      : style === "ponytail"
        ? "left-[29%] top-[8%] h-[24%] w-[42%]"
        : "left-[33%] top-[9%] h-[20%] w-[34%]";
  return (
    <span
      className={`absolute ${sizeClass} rounded-[45%] opacity-20 mix-blend-multiply blur-[1px]`}
      style={{ backgroundColor: HAIR_COLORS[color] }}
    />
  );
}

function FaceAccent({ faceShape, expression }: { faceShape: CharacterFaceShape; expression: CharacterExpression }) {
  const shapeClass =
    faceShape === "oval"
      ? "left-[42%] top-[21%] h-[12%] w-[15%] rounded-[50%]"
      : faceShape === "soft_square"
        ? "left-[41%] top-[21%] h-[12%] w-[17%] rounded-[35%]"
        : "left-[41%] top-[21%] h-[13%] w-[17%] rounded-full";
  return (
    <span className={`absolute ${shapeClass} border-2 border-white/70 bg-rose-100/35 shadow-[0_0_0_1px_rgba(244,114,182,0.22)]`}>
      <ExpressionMark expression={expression} />
    </span>
  );
}

function ExpressionMark({ expression }: { expression: CharacterExpression }) {
  if (expression === "calm") {
    return <span className="absolute left-[31%] top-[57%] h-[9%] w-[38%] rounded-full bg-slate-800/70" />;
  }

  if (expression === "focus") {
    return (
      <>
        <span className="absolute left-[26%] top-[35%] h-[9%] w-[17%] -rotate-12 rounded-full bg-slate-900/75" />
        <span className="absolute right-[26%] top-[35%] h-[9%] w-[17%] rotate-12 rounded-full bg-slate-900/75" />
        <span className="absolute left-[34%] top-[60%] h-[8%] w-[32%] rounded-full bg-slate-900/70" />
      </>
    );
  }

  if (expression === "joy") {
    return (
      <>
        <span className="absolute left-[26%] top-[34%] h-[10%] w-[18%] rounded-t-full border-t-2 border-slate-900/75" />
        <span className="absolute right-[26%] top-[34%] h-[10%] w-[18%] rounded-t-full border-t-2 border-slate-900/75" />
        <span className="absolute left-[32%] top-[54%] h-[22%] w-[36%] rounded-b-full bg-rose-500/80" />
      </>
    );
  }

  return (
    <>
      <span className="absolute left-[30%] top-[36%] size-[10%] rounded-full bg-slate-900/75" />
      <span className="absolute right-[30%] top-[36%] size-[10%] rounded-full bg-slate-900/75" />
      <span className="absolute left-[32%] top-[57%] h-[20%] w-[36%] rounded-b-full border-b-2 border-slate-900/75" />
    </>
  );
}

function OutfitAccent({ color, style }: { color: CharacterTopColor; style: CharacterTopStyle }) {
  const shapeClass =
    style === "hoodie"
      ? "left-[34%] top-[43%] h-[21%] w-[32%] rounded-[32%]"
      : style === "neat"
        ? "left-[36%] top-[44%] h-[18%] w-[28%] rounded-[18%]"
        : style === "worship"
          ? "left-[34%] top-[43%] h-[20%] w-[32%] rounded-[42%]"
          : "left-[35%] top-[44%] h-[19%] w-[30%] rounded-[36%]";
  return (
    <>
      <span className={`absolute ${shapeClass} opacity-25 mix-blend-multiply`} style={{ backgroundColor: TOP_COLORS[color] }} />
      {style === "worship" ? <span className="absolute left-[45%] top-[46%] h-[14%] w-[10%] rotate-45 rounded-sm border-2 border-amber-300/80" /> : null}
      {style === "hoodie" ? <span className="absolute left-[42%] top-[42%] h-[9%] w-[16%] rounded-full border-2 border-white/70" /> : null}
      {style === "neat" ? <span className="absolute left-[47%] top-[45%] h-[17%] w-[2%] rounded-full bg-white/70" /> : null}
    </>
  );
}

function BottomAccent({ color }: { color: CharacterBottomColor }) {
  return <span className="absolute left-[40%] top-[62%] h-[18%] w-[20%] rounded-[30%] opacity-20 mix-blend-multiply" style={{ backgroundColor: BOTTOM_COLORS[color] }} />;
}

const HAIR_COLORS: Record<CharacterHairColor, string> = {
  black: "#111827",
  brown: "#8B5E34",
  dark_brown: "#4B2E1F",
  light_brown: "#B77945",
};

const TOP_COLORS: Record<CharacterTopColor, string> = {
  black: "#111827",
  white: "#F8FAFC",
  blue: "#2563EB",
  indigo: "#4F46E5",
  green: "#059669",
  beige: "#D8B384",
};

const BOTTOM_COLORS: Record<CharacterBottomColor, string> = {
  black: "#111827",
  navy: "#1E3A8A",
  gray: "#64748B",
};
