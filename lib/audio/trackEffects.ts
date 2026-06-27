"use client";

export type CompressorPreset = "off" | "light" | "medium" | "strong";
export type ReverbType = "off" | "small_room" | "chapel" | "wide_hall";

export type TrackEffectSettings = {
  gainDb: number;
  eq: {
    lowGainDb: number;
    midGainDb: number;
    highGainDb: number;
  };
  compressor: {
    enabled: boolean;
    preset: CompressorPreset;
  };
  reverb: {
    type: ReverbType;
    amount: number;
  };
};

export const DEFAULT_TRACK_EFFECTS: TrackEffectSettings = {
  gainDb: 0,
  eq: {
    lowGainDb: 0,
    midGainDb: 0,
    highGainDb: 0,
  },
  compressor: {
    enabled: false,
    preset: "off",
  },
  reverb: {
    type: "off",
    amount: 0,
  },
};

export function normalizeTrackEffects(effects?: Partial<TrackEffectSettings> | null): TrackEffectSettings {
  const compressorPreset: CompressorPreset = isCompressorPreset(effects?.compressor?.preset)
    ? effects.compressor.preset
    : DEFAULT_TRACK_EFFECTS.compressor.preset;
  const reverbType: ReverbType = isReverbType(effects?.reverb?.type)
    ? effects.reverb.type
    : DEFAULT_TRACK_EFFECTS.reverb.type;
  const compressorEnabledByPreset = compressorPreset !== "off";

  return {
    gainDb: clampNumber(effects?.gainDb, -12, 12, DEFAULT_TRACK_EFFECTS.gainDb),
    eq: {
      lowGainDb: clampNumber(effects?.eq?.lowGainDb, -12, 12, DEFAULT_TRACK_EFFECTS.eq.lowGainDb),
      midGainDb: clampNumber(effects?.eq?.midGainDb, -12, 12, DEFAULT_TRACK_EFFECTS.eq.midGainDb),
      highGainDb: clampNumber(effects?.eq?.highGainDb, -12, 12, DEFAULT_TRACK_EFFECTS.eq.highGainDb),
    },
    compressor: {
      enabled: compressorEnabledByPreset && Boolean(effects?.compressor?.enabled ?? compressorEnabledByPreset),
      preset: compressorPreset,
    },
    reverb: {
      type: reverbType,
      amount: reverbType === "off" ? 0 : clampNumber(effects?.reverb?.amount, 0, 1, DEFAULT_TRACK_EFFECTS.reverb.amount),
    },
  };
}

export function dbToGain(db: number) {
  return Math.pow(10, db / 20);
}

export function volumeToDb(volume: number) {
  if (volume <= 0.001) return "음소거";
  const db = 20 * Math.log10(Math.max(0.001, volume));
  return `${db.toFixed(1)} dB`;
}

export function getCompressorValues(preset: CompressorPreset) {
  if (preset === "light") return { threshold: -18, ratio: 2, attack: 0.01, release: 0.25 };
  if (preset === "medium") return { threshold: -24, ratio: 4, attack: 0.01, release: 0.25 };
  if (preset === "strong") return { threshold: -30, ratio: 8, attack: 0.005, release: 0.3 };
  return { threshold: 0, ratio: 1, attack: 0.01, release: 0.25 };
}

export function getReverbValues(type: ReverbType) {
  if (type === "small_room") return { delayTime: 0.055, feedback: 0.18 };
  if (type === "chapel") return { delayTime: 0.11, feedback: 0.28 };
  if (type === "wide_hall") return { delayTime: 0.18, feedback: 0.38 };
  return { delayTime: 0.04, feedback: 0 };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(min, Math.min(max, numberValue));
}

function isCompressorPreset(value: unknown): value is CompressorPreset {
  return value === "off" || value === "light" || value === "medium" || value === "strong";
}

function isReverbType(value: unknown): value is ReverbType {
  return value === "off" || value === "small_room" || value === "chapel" || value === "wide_hall";
}
