export type Setlist = {
  id: string;
  title: string;
  worshipDate: string;
  serviceName: string;
  description?: string;
  globalNotes?: string;
  songs: Song[];
  teamAssignments: TeamAssignment[];
  createdAt: string;
  updatedAt: string;
};

export type Song = {
  id: string;
  title: string;
  description?: string;
  transitionNote?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  originalKey?: string;
  practiceKey?: string;
  bpm?: number;
  sections: SongSection[];
  highlights: string[];
  partNotes: PartNote[];
  links?: SongLink[];
  capo?: number;
  chordForm?: string;
  transposeMemo?: string;
  chordMemo?: string;
  chordProgression?: string;
  sheetLinks?: SongLink[];
};

export type SavedSong = {
  id: string;
  song: Song;
  createdAt: string;
  updatedAt: string;
};

export type SongSection = {
  id: string;
  name: string;
  startTime?: number;
  endTime?: number;
  memo?: string;
};

export type PartNote = {
  id: string;
  part: string;
  note: string;
};

export type SongLink = {
  id: string;
  label: string;
  url: string;
};

export type TeamAssignment = {
  id: string;
  name: string;
  part: string;
  note?: string;
};

export type CapoSuggestion = {
  chordForm: string;
  capo: number;
  actualKey: string;
  label: string;
};

export const DEFAULT_PARTS = ["보컬", "일렉", "어쿠스틱", "건반", "베이스", "드럼", "기타"] as const;
export const DEFAULT_TEAM_PARTS = [
  "인도자",
  "싱어",
  "일렉",
  "어쿠스틱",
  "건반",
  "베이스",
  "드럼",
  "음향",
  "자막",
  "방송",
  "기타",
] as const;
