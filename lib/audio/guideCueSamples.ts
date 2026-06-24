import type { GuideTrackData } from "@/lib/db/teamGuideTracks";

export async function loadGuideVoiceCueBuffers(context: BaseAudioContext, data: Pick<GuideTrackData, "sections" | "voiceCue">) {
  const language = data.voiceCue.language === "ko" ? "ko" : "en";
  const slugs = Array.from(new Set(data.sections.map((section) => getGuideVoiceCueSlug(section.label)).concat("section")));
  const entries = await Promise.all(
    slugs.map(async (slug) => {
      const buffer = await fetchGuideVoiceCueBuffer(context, language, slug);
      return [slug, buffer] as const;
    }),
  );

  const buffers = new Map<string, AudioBuffer>();
  entries.forEach(([slug, buffer]) => {
    if (buffer) buffers.set(slug, buffer);
  });
  return buffers;
}

export async function fetchGuideVoiceCueBuffer(context: BaseAudioContext, language: "en" | "ko", slug: string) {
  const paths = [`/audio/guide-cues/${language}/${slug}.m4a`, `/audio/guide-cues/en/${slug}.m4a`, "/audio/guide-cues/en/section.m4a"];

  for (const path of paths) {
    try {
      const response = await fetch(path);
      if (!response.ok) continue;
      return await context.decodeAudioData(await response.arrayBuffer());
    } catch {
      // 샘플이 없거나 브라우저 디코딩이 실패하면 다음 fallback을 시도한다.
    }
  }

  return null;
}

export function getGuideVoiceCueSlug(label: string) {
  const normalized = label.trim().toLowerCase();
  if (/인트로|intro/.test(normalized)) return "intro";
  if (/pre|프리/.test(normalized)) return "pre-chorus";
  if (/후렴|chorus/.test(normalized)) return "chorus";
  if (/브릿지|bridge/.test(normalized)) return "bridge";
  if (/간주|interlude/.test(normalized)) return "interlude";
  if (/아웃트로|outro/.test(normalized)) return "outro";
  if (/엔딩|ending/.test(normalized)) return "ending";
  if (/벌스\s*2|verse\s*2|2\s*절|둘째\s*절/.test(normalized)) return "verse-2";
  if (/벌스\s*1|verse\s*1|1\s*절|첫\s*절|첫째\s*절/.test(normalized)) return "verse-1";
  if (/벌스|절|verse/.test(normalized)) return "verse";
  return "section";
}

export function scheduleGuideVoiceCue(context: BaseAudioContext, buffer: AudioBuffer, time: number, volume: number) {
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  gain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)) * 0.95, time);
  source.connect(gain).connect(context.destination);
  source.start(time);
  return source;
}
