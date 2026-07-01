import type { StageCharacterConfig } from "@/lib/characters/characterConfig";

type CharacterPreviewProps = {
  config: StageCharacterConfig;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SKIN_TONES: Record<StageCharacterConfig["skinTone"], string> = {
  light: "#F8D8C4",
  medium: "#E9B98F",
  warm: "#D99A6C",
  deep: "#9A5E3E",
};

const HAIR_COLORS: Record<StageCharacterConfig["hairColor"], string> = {
  black: "#1F2937",
  brown: "#8B5E34",
  dark_brown: "#4B2E21",
  blonde: "#D9A441",
};

const ITEM_COLORS: Partial<Record<StageCharacterConfig["item"], string>> = {
  electric_guitar: "#2563EB",
  acoustic_guitar: "#D97706",
  bass: "#7C3AED",
  keyboard: "#475569",
  mic: "#0F172A",
  drumsticks: "#B45309",
  cajon: "#92400E",
  in_ear: "#0891B2",
  leader: "#F59E0B",
};

export function CharacterPreview({ config, size = "lg", className = "" }: CharacterPreviewProps) {
  const dimensions = size === "sm" ? "size-16" : size === "md" ? "size-32" : "size-56";
  const skinColor = SKIN_TONES[config.skinTone];
  const hairColor = HAIR_COLORS[config.hairColor];
  const itemColor = ITEM_COLORS[config.item] ?? "#64748B";
  const faceRx = config.faceShape === "circle" ? 42 : config.faceShape === "oval" ? 36 : 30;
  const faceRy = config.faceShape === "square_round" ? 36 : 42;
  const bodyRx = config.style === "simple" ? 24 : 34;
  const shadowOpacity = config.style === "soft" ? 0.18 : 0.11;

  return (
    <div
      className={`relative inline-flex ${dimensions} items-center justify-center overflow-hidden rounded-[2rem] border border-white/80 shadow-sm ${className}`}
      style={{ backgroundColor: config.backgroundColor ?? "#EEF2FF" }}
      aria-label="프로필 캐릭터 미리보기"
      role="img"
    >
      <svg viewBox="0 0 220 220" className="h-full w-full" aria-hidden="true">
        <ellipse cx="110" cy="196" rx="62" ry="12" fill="#0F172A" opacity={shadowOpacity} />
        <path
          d="M68 150c4-27 24-45 42-45s38 18 42 45l6 42H62l6-42Z"
          fill={config.topColor}
          stroke="#FFFFFF"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <path d="M78 190h64l8 18H70l8-18Z" fill={config.bottomColor} />
        <path d="M70 151c-18 9-27 23-25 39" stroke={config.topColor} strokeWidth="18" strokeLinecap="round" />
        <path d="M150 151c18 9 27 23 25 39" stroke={config.topColor} strokeWidth="18" strokeLinecap="round" />
        <ellipse cx="110" cy="86" rx={faceRx} ry={faceRy} fill={skinColor} stroke="#FFFFFF" strokeWidth="6" />
        <Hair style={config.hairStyle} color={hairColor} />
        <Expression expression={config.expression} />
        <Item item={config.item} color={itemColor} />
      </svg>
    </div>
  );
}

function Hair({ style, color }: { style: StageCharacterConfig["hairStyle"]; color: string }) {
  if (style === "none") return null;
  if (style === "cap") {
    return (
      <>
        <path d="M70 76c8-31 72-31 80 0v5H70v-5Z" fill={color} />
        <path d="M145 79c17 1 28 7 33 15-16 2-29 0-42-8l9-7Z" fill={color} />
      </>
    );
  }
  if (style === "long") {
    return <path d="M70 86c-3-37 20-62 41-62s45 25 39 68c-16-17-25-35-40-35-16 0-28 18-40 29Z" fill={color} />;
  }
  if (style === "medium") {
    return <path d="M71 76c6-35 72-43 80 5-18-3-27-18-41-18-15 0-25 15-39 13Z" fill={color} />;
  }
  if (style === "curly") {
    return (
      <>
        {[
          [72, 74],
          [89, 56],
          [110, 49],
          [131, 56],
          [148, 74],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="19" fill={color} />
        ))}
      </>
    );
  }
  return <path d="M71 76c5-32 68-40 78 2-24-1-32-16-47-14-11 1-18 9-31 12Z" fill={color} />;
}

function Expression({ expression }: { expression: StageCharacterConfig["expression"] }) {
  const eyeY = expression === "joy" ? 82 : 84;
  return (
    <>
      {expression === "focus" ? (
        <>
          <path d="M91 82h13" stroke="#1F2937" strokeWidth="5" strokeLinecap="round" />
          <path d="M116 82h13" stroke="#1F2937" strokeWidth="5" strokeLinecap="round" />
        </>
      ) : expression === "joy" ? (
        <>
          <path d="M91 83c4-5 9-5 13 0" stroke="#1F2937" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M116 83c4-5 9-5 13 0" stroke="#1F2937" strokeWidth="4" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <circle cx="96" cy={eyeY} r="4" fill="#1F2937" />
          <circle cx="124" cy={eyeY} r="4" fill="#1F2937" />
        </>
      )}
      {expression === "calm" ? (
        <path d="M99 106h22" stroke="#9A3412" strokeWidth="4" strokeLinecap="round" />
      ) : expression === "focus" ? (
        <path d="M100 107c7 4 14 4 21 0" stroke="#9A3412" strokeWidth="4" strokeLinecap="round" fill="none" />
      ) : (
        <path d="M96 105c8 10 20 10 28 0" stroke="#9A3412" strokeWidth="5" strokeLinecap="round" fill="none" />
      )}
    </>
  );
}

function Item({ item, color }: { item: StageCharacterConfig["item"]; color: string }) {
  if (item === "none") return null;
  if (item === "mic") {
    return (
      <g transform="translate(145 145) rotate(-22)">
        <rect x="0" y="12" width="10" height="42" rx="5" fill="#334155" />
        <rect x="-5" y="0" width="20" height="20" rx="10" fill={color} />
      </g>
    );
  }
  if (item === "keyboard") {
    return (
      <g transform="translate(62 156)">
        <rect width="96" height="28" rx="8" fill="#FFFFFF" stroke={color} strokeWidth="5" />
        {[10, 25, 40, 55, 70].map((x) => (
          <rect key={x} x={x} y="5" width="8" height="18" rx="2" fill={color} opacity="0.8" />
        ))}
      </g>
    );
  }
  if (item === "drumsticks") {
    return (
      <g stroke={color} strokeWidth="6" strokeLinecap="round">
        <path d="M62 162l44 28" />
        <path d="M106 162l-44 28" />
      </g>
    );
  }
  if (item === "cajon") {
    return <rect x="76" y="154" width="68" height="48" rx="9" fill={color} opacity="0.85" />;
  }
  if (item === "in_ear") {
    return (
      <g fill="none" stroke={color} strokeWidth="4" strokeLinecap="round">
        <path d="M78 92c-18 19-17 39 1 57" />
        <path d="M142 92c18 19 17 39-1 57" />
      </g>
    );
  }
  if (item === "leader") {
    return (
      <g transform="translate(146 146) rotate(-18)">
        <path d="M0 18h42" stroke={color} strokeWidth="7" strokeLinecap="round" />
        <path d="M37 9l12 9-12 9" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  }

  const isBass = item === "bass";
  const bodyColor = item === "acoustic_guitar" ? "#D97706" : color;
  return (
    <g transform="translate(139 143) rotate(-28)">
      <ellipse cx="13" cy="37" rx={isBass ? 13 : 16} ry="22" fill={bodyColor} />
      <rect x="8" y="-16" width="9" height="55" rx="4" fill="#78350F" />
      <path d="M2-18h22" stroke="#78350F" strokeWidth="7" strokeLinecap="round" />
      <path d="M10 1v74" stroke="#FFFFFF" strokeWidth="2" opacity="0.7" />
    </g>
  );
}
