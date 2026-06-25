import type { GuideTrackData } from "@/lib/db/teamGuideTracks";

export type StudioTimelineSegment = {
  id: string;
  label: string;
  startSec: number;
  endSec: number;
  startBar: number;
  bars: number;
};

export type StudioCurrentPosition = {
  label: string;
  bar: number;
  beat: number;
};

export function getBeatsPerBar(timeSignature: string) {
  const top = Number(timeSignature.split("/")[0]);
  return Number.isFinite(top) && top > 0 ? top : 4;
}

export function getGuideBeatSeconds(data: GuideTrackData) {
  const bpm = data.bpm && data.bpm > 0 ? data.bpm : 72;
  return 60 / bpm;
}

export function getGuideCountInSeconds(data: GuideTrackData) {
  if (!data.countIn.enabled) return 0;
  return data.countIn.bars * getBeatsPerBar(data.timeSignature) * getGuideBeatSeconds(data);
}

export function getGuideTrackTotalBars(data: GuideTrackData) {
  return data.sections.reduce((sum, section) => sum + Math.max(1, section.bars) * Math.max(1, section.repeat), 0);
}

export function getGuideTrackDurationSeconds(data: GuideTrackData) {
  const beatSec = getGuideBeatSeconds(data);
  const beatsPerBar = getBeatsPerBar(data.timeSignature);
  return getGuideCountInSeconds(data) + getGuideTrackTotalBars(data) * beatsPerBar * beatSec;
}

export function buildStudioTimelineSegments(data: GuideTrackData): StudioTimelineSegment[] {
  const beatSec = getGuideBeatSeconds(data);
  const beatsPerBar = getBeatsPerBar(data.timeSignature);
  const barSec = beatSec * beatsPerBar;
  const segments: StudioTimelineSegment[] = [];
  let cursorSec = 0;
  let cursorBar = 1;

  if (data.countIn.enabled && data.countIn.bars > 0) {
    const countInSec = data.countIn.bars * barSec;
    segments.push({
      id: "count-in",
      label: "Count-in",
      startSec: 0,
      endSec: countInSec,
      startBar: 0,
      bars: data.countIn.bars,
    });
    cursorSec += countInSec;
  }

  data.sections.forEach((section, sectionIndex) => {
    const bars = Math.max(1, section.bars) * Math.max(1, section.repeat);
    const endSec = cursorSec + bars * barSec;
    segments.push({
      id: section.sectionId || `${section.label}-${sectionIndex}`,
      label: section.label,
      startSec: cursorSec,
      endSec,
      startBar: cursorBar,
      bars,
    });
    cursorSec = endSec;
    cursorBar += bars;
  });

  return segments;
}

export function getStudioCurrentPosition(data: GuideTrackData, currentTime: number): StudioCurrentPosition {
  const beatSec = getGuideBeatSeconds(data);
  const beatsPerBar = getBeatsPerBar(data.timeSignature);
  const countInSec = getGuideCountInSeconds(data);
  const segments = buildStudioTimelineSegments(data);
  const activeSegment = segments.find((segment) => currentTime >= segment.startSec && currentTime < segment.endSec);

  if (currentTime < countInSec && data.countIn.enabled) {
    const beatIndex = Math.max(0, Math.floor(currentTime / beatSec));
    return {
      label: "카운트인",
      bar: 0,
      beat: (beatIndex % beatsPerBar) + 1,
    };
  }

  const songTime = Math.max(0, currentTime - countInSec);
  const beatIndex = Math.floor(songTime / beatSec);
  return {
    label: activeSegment?.label ?? "재생 중",
    bar: Math.floor(beatIndex / beatsPerBar) + 1,
    beat: (beatIndex % beatsPerBar) + 1,
  };
}
