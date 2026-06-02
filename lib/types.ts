export type Setlist = {
  id: string;
  title: string;
  worshipDate: string;
  serviceName: string;
  description?: string;
  globalNotes?: string;
  songs: Song[];
  createdAt: string;
  updatedAt: string;
};

export type Song = {
  id: string;
  title: string;
  description?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  originalKey?: string;
  practiceKey?: string;
  bpm?: number;
  sections: SongSection[];
  highlights: string[];
  partNotes: PartNote[];
  links?: SongLink[];
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

export const DEFAULT_PARTS = ["보컬", "일렉", "어쿠스틱", "건반", "베이스", "드럼", "기타"] as const;
