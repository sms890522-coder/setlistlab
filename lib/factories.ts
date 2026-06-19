import { createId } from "./id";
import type { PartNote, Setlist, Song, SongLink, SongSection, TeamAssignment } from "./types";

export function createBlankSetlist(): Setlist {
  const now = new Date().toISOString();

  return {
    id: createId("setlist"),
    teamId: undefined,
    status: "draft",
    publishedAt: undefined,
    notificationSentAt: undefined,
    title: "",
    worshipDate: formatDateInput(new Date()),
    serviceName: "",
    description: "",
    globalNotes: "",
    songs: [],
    teamAssignments: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createBlankSong(): Song {
  return {
    id: createId("song"),
    title: "",
    description: "",
    transitionNote: "",
    youtubeUrl: "",
    youtubeVideoId: undefined,
    originalKey: "",
    practiceKey: "",
    bpm: undefined,
    sections: [],
    highlights: [],
    partNotes: [],
    links: [],
    capo: undefined,
    chordForm: "",
    transposeMemo: "",
    chordMemo: "",
    chordProgression: "",
    sheetLinks: [],
    imageLinks: [],
  };
}

export function cloneSong(song: Song): Song {
  return {
    ...song,
    id: createId("song"),
    sections: song.sections.map((section) => ({ ...section, id: createId("section") })),
    partNotes: song.partNotes.map((partNote) => ({ ...partNote, id: createId("part") })),
    links: song.links?.map((link) => ({ ...link, id: createId("link") })) ?? [],
    sheetLinks: song.sheetLinks?.map((link) => ({ ...link, id: createId("sheet-link") })) ?? [],
    imageLinks: song.imageLinks?.map((link) => ({ ...link, id: createId("image-link") })) ?? [],
  };
}

export function cloneSetlist(setlist: Setlist): Setlist {
  const now = new Date().toISOString();

  return {
    ...setlist,
    id: createId("setlist"),
    status: "draft",
    publishedAt: undefined,
    notificationSentAt: undefined,
    title: `${setlist.title || "제목 없는 콘티"} 복사본`,
    songs: setlist.songs.map(cloneSong),
    teamAssignments: setlist.teamAssignments.map((assignment) => ({ ...assignment, id: createId("assignment") })),
    createdAt: now,
    updatedAt: now,
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

export function createBlankSongLink(): SongLink {
  return {
    id: createId("sheet-link"),
    label: "",
    url: "",
  };
}

export function createBlankTeamAssignment(part = "싱어"): TeamAssignment {
  return {
    id: createId("assignment"),
    name: "",
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
