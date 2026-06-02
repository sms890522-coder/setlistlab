import { createId } from "./id";
import type { PartNote, Setlist, Song, SongSection } from "./types";

export function createBlankSetlist(): Setlist {
  const now = new Date().toISOString();

  return {
    id: createId("setlist"),
    title: "새 콘티",
    worshipDate: formatDateInput(new Date()),
    serviceName: "",
    description: "",
    globalNotes: "",
    songs: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createBlankSong(): Song {
  return {
    id: createId("song"),
    title: "새 찬양곡",
    description: "",
    youtubeUrl: "",
    youtubeVideoId: undefined,
    originalKey: "",
    practiceKey: "",
    bpm: undefined,
    sections: [],
    highlights: [],
    partNotes: [],
    links: [],
  };
}

export function createBlankSection(): SongSection {
  return {
    id: createId("section"),
    name: "구간",
    startTime: undefined,
    endTime: undefined,
    memo: "",
  };
}

export function createBlankPartNote(part = "보컬"): PartNote {
  return {
    id: createId("part"),
    part,
    note: "",
  };
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
