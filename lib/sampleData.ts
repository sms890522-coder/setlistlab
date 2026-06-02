import { createId } from "./id";
import type { Setlist, Song } from "./types";

function makeSections(names: Array<[string, number, number, string]>) {
  return names.map(([name, startTime, endTime, memo]) => ({
    id: createId("section"),
    name,
    startTime,
    endTime,
    memo,
  }));
}

function makeSong(song: Omit<Song, "id">): Song {
  return {
    id: createId("song"),
    ...song,
  };
}

export function createSampleSetlist(): Setlist {
  const now = new Date().toISOString();

  return {
    id: "sample-2026-06-07",
    title: "2026년 6월 7일 주일예배 콘티",
    worshipDate: "2026-06-07",
    serviceName: "주일 2부예배",
    description: "오늘은 고백적인 흐름으로 시작해 선포와 결단으로 이어갑니다.",
    globalNotes: "곡 사이 전환을 길게 끌지 않고, 후반부는 회중이 따라오기 쉬운 키와 템포로 안정감 있게 진행합니다.",
    createdAt: now,
    updatedAt: now,
    songs: [
      makeSong({
        title: "나는 예배자입니다",
        description: "담백한 고백으로 예배의 문을 여는 곡입니다.",
        youtubeUrl: "https://www.youtube.com/watch?v=PLACEHOLDER_01",
        originalKey: "F",
        practiceKey: "F",
        bpm: 68,
        sections: makeSections([
          ["Intro", 0, 18, "일렉 딜레이 타이밍 주의"],
          ["Verse1", 19, 55, "보컬만 담백하게"],
          ["Verse2", 56, 90, "건반 패드를 조금 더 채우기"],
          ["Chorus", 91, 130, "드럼과 일렉 빌드업"],
          ["Interlude", 131, 148, "다음 후렴 전 호흡 정리"],
          ["Chorus", 149, 190, "회중 소리 열어주기"],
          ["Ending", 191, 215, "마지막 코드 길게"],
        ]),
        highlights: ["첫 곡이라 과하게 몰아가지 않기", "후렴 두 번째 반복부터 다이내믹을 넓히기"],
        partNotes: [
          { id: createId("part"), part: "보컬", note: "후렴 화음은 2번째 반복부터 얇게 넣기" },
          { id: createId("part"), part: "일렉", note: "인트로 딜레이 1/8D 느낌 유지" },
          { id: createId("part"), part: "드럼", note: "2절 후렴부터 오픈" },
        ],
        links: [],
      }),
      makeSong({
        title: "주님은 산 같아서",
        description: "신뢰의 고백으로 자연스럽게 분위기를 올립니다.",
        youtubeUrl: "https://youtu.be/PLACEHOLDER_02",
        originalKey: "A",
        practiceKey: "A",
        bpm: 72,
        sections: makeSections([
          ["Intro", 0, 16, "건반 리드로 시작"],
          ["Verse", 17, 60, "보컬 발음 또렷하게"],
          ["Chorus", 61, 104, "베이스 루트 안정감"],
          ["Bridge", 105, 145, "브릿지는 과하지 않게 상승"],
          ["Chorus", 146, 190, "마지막 후렴은 회중 인도"],
          ["Ending", 191, 210, "깔끔하게 컷"],
        ]),
        highlights: ["브릿지 진입 전 템포 흔들리지 않기", "후렴 끝 호흡을 맞추기"],
        partNotes: [
          { id: createId("part"), part: "건반", note: "인트로는 패드보다 피아노 톤 중심" },
          { id: createId("part"), part: "베이스", note: "후렴 루트 이동을 넓게 잡지 않기" },
        ],
        links: [],
      }),
      makeSong({
        title: "예수 열방의 소망",
        description: "선포와 결단으로 이어지는 밝은 템포의 곡입니다.",
        youtubeUrl: "https://www.youtube.com/embed/PLACEHOLDER_03",
        originalKey: "G",
        practiceKey: "G",
        bpm: 120,
        sections: makeSections([
          ["Intro", 0, 12, "드럼 카운트 후 전체 진입"],
          ["Verse", 13, 42, "기타 스트로크 정돈"],
          ["Pre-Chorus", 43, 58, "보컬 호흡 짧게"],
          ["Chorus", 59, 88, "힘 있게 선포"],
          ["Bridge", 89, 116, "다이내믹 한 번 낮췄다가 상승"],
          ["Chorus", 117, 148, "마지막 반복 회중 유도"],
          ["Ending", 149, 164, "엔딩 리듬 합 맞추기"],
        ]),
        highlights: ["템포가 빨라지는 느낌이 나지 않게 클릭 기준 연습", "브릿지 이후 후렴 진입을 명확하게"],
        partNotes: [
          { id: createId("part"), part: "어쿠스틱", note: "벌스는 8비트 스트로크를 가볍게" },
          { id: createId("part"), part: "드럼", note: "브릿지 후반 필인은 짧고 명확하게" },
        ],
        links: [],
      }),
    ],
  };
}
