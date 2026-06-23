import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.GUIDE_SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const outputDir = path.join(process.cwd(), "public", "guide");
const desktopOutputDir = path.join(outputDir, "desktop");
const guideSetlistId = "guide-real-setlist";
const guideSongId = "guide-real-song-1";
const setlistsStorageKey = "conti-practice-room:setlists";
const initializedStorageKey = "conti-practice-room:initialized";

const viewportTargets = [
  { name: "mobile", outputDir, viewport: { width: 390, height: 844 } },
  { name: "desktop", outputDir: desktopOutputDir, viewport: { width: 1280, height: 900 } },
] as const;

const screenshots = [
  { pagePath: "/setlists/new", target: "create-setlist", fileName: "create-setlist.png" },
  { pagePath: `/setlists/${guideSetlistId}/edit`, target: "song-form-editor", fileName: "song-form-editor.png" },
  { pagePath: `/setlists/${guideSetlistId}`, target: "view-setlist", fileName: "view-setlist.png" },
  { pagePath: `/setlists/${guideSetlistId}/songs/${guideSongId}`, target: "youtube-practice", fileName: "youtube-practice.png" },
  { pagePath: `/setlists/${guideSetlistId}/songs/${guideSongId}`, target: "loop-control", fileName: "loop-control.png" },
  { pagePath: `/setlists/${guideSetlistId}/songs/${guideSongId}`, target: "playback-speed", fileName: "playback-speed.png" },
  { pagePath: `/setlists/${guideSetlistId}/songs/${guideSongId}`, target: "song-form-navigation", fileName: "song-form-navigation.png" },
  { pagePath: `/setlists/${guideSetlistId}/songs/${guideSongId}`, target: "score-image", fileName: "score-image.png" },
  { pagePath: `/setlists/${guideSetlistId}/pdf`, target: "pdf-export", fileName: "pdf-export.png" },
  { pagePath: `/setlists/${guideSetlistId}/pdf`, target: "pdf-customize", fileName: "pdf-customize.png" },
  { pagePath: "/guide/demo/team-dashboard", target: "team-dashboard", fileName: "team-dashboard.png" },
  { pagePath: "/guide/demo/team-dashboard", target: "team-invite", fileName: "team-invite.png" },
  { pagePath: "/guide/demo/team-chat", target: "team-chat", fileName: "team-chat.png" },
  { pagePath: "/guide/demo/team-chat", target: "team-notice", fileName: "team-notice.png" },
  { pagePath: "/guide/demo/team-calendar", target: "team-calendar", fileName: "team-calendar.png" },
  { pagePath: "/guide/demo/team-calendar", target: "availability-check", fileName: "availability-check.png" },
  { pagePath: "/tools/tuner", target: "tuner", fileName: "tuner.png" },
  { pagePath: "/tools/tuner?tool=metronome&bpm=72", target: "metronome", fileName: "metronome.png" },
] as const;

test.use({ colorScheme: "light" });

test.describe("guide screenshots", () => {
  test.beforeAll(async () => {
    await mkdir(outputDir, { recursive: true });
    await mkdir(desktopOutputDir, { recursive: true });
  });

  for (const viewportTarget of viewportTargets) {
    for (const screenshot of screenshots) {
      test(`capture ${viewportTarget.name} ${screenshot.fileName}`, async ({ page }) => {
        await page.setViewportSize(viewportTarget.viewport);
        await seedGuideSetlist(page, baseUrl);
        await page.goto(`${baseUrl}${screenshot.pagePath}`, { waitUntil: "domcontentloaded" });
        await page.addStyleTag({
          content: `
            header.sticky,
            nextjs-portal,
            [data-nextjs-dev-overlay],
            [data-nextjs-dev-tools-button],
            [data-nextjs-toast],
            .team-chat-widget,
            .team-chat-panel {
              display: none !important;
            }
          `,
        });
        await page.waitForTimeout(250);

        const target = page.locator(`[data-guide-shot="${screenshot.target}"]`).first();
        await expect(target).toBeVisible({ timeout: 10_000 });
        await target.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
        await page.waitForTimeout(100);
        await target.screenshot({
          path: path.join(viewportTarget.outputDir, screenshot.fileName),
          animations: "disabled",
        });
      });
    }
  }
});

async function seedGuideSetlist(page: import("@playwright/test").Page, siteUrl: string) {
  await page.addInitScript(
    ({ setlistsKey, initializedKey, setlist }) => {
      window.localStorage.setItem(setlistsKey, JSON.stringify([setlist]));
      window.localStorage.setItem(initializedKey, "true");
    },
    {
      setlistsKey: setlistsStorageKey,
      initializedKey: initializedStorageKey,
      setlist: createGuideSetlist(siteUrl),
    },
  );
}

function createGuideSetlist(siteUrl: string) {
  const now = "2026-06-21T00:00:00.000Z";
  const imageUrl = `${siteUrl}/guide/demo-score.svg`;

  return {
    id: guideSetlistId,
    status: "published",
    title: "6월 21일 주일예배 콘티",
    worshipDate: "2026-06-21",
    serviceName: "주일 2부예배",
    description: "이번 주는 말씀에 순종하는 고백에서 시작해 회중 선포로 이어지는 흐름입니다.",
    globalNotes: "첫 곡은 절제하고, 두 번째 곡부터 회중 고백이 살아나도록 다이내믹을 넓혀 주세요.",
    createdAt: now,
    updatedAt: now,
    teamAssignments: [
      { id: "guide-assignment-1", name: "김민수", part: "인도자", note: "전체 인도" },
      { id: "guide-assignment-2", name: "이은혜", part: "싱어" },
      { id: "guide-assignment-3", name: "정현우", part: "일렉" },
      { id: "guide-assignment-4", name: "최수진", part: "건반" },
      { id: "guide-assignment-5", name: "강준호", part: "드럼" },
    ],
    songs: [
      {
        id: guideSongId,
        title: "주님 말씀하시면",
        description: "말씀에 순종하는 고백으로 예배의 흐름을 여는 곡입니다.",
        transitionNote: "다음 곡으로 넘어가기 전 짧게 기도합니다.",
        youtubeUrl: "https://youtu.be/w9QvvOj1dn4",
        youtubeVideoId: "w9QvvOj1dn4",
        originalKey: "G",
        practiceKey: "G",
        bpm: 72,
        capo: 0,
        chordForm: "G",
        transposeMemo: "이번 주는 G키 원곡 흐름으로 진행합니다.",
        chordMemo: "어쿠스틱은 G폼, 일렉은 실제 키 기준으로 연주합니다.",
        chordProgression: "G - D - Em - C",
        sections: [
          { id: "guide-section-1", name: "Intro", startTime: 0, endTime: 18, memo: "어쿠스틱만 가볍게" },
          { id: "guide-section-2", name: "Verse 1", startTime: 19, endTime: 52, memo: "보컬은 담백하게" },
          { id: "guide-section-3", name: "Chorus", startTime: 53, endTime: 90, memo: "드럼은 후반 빌드업" },
          { id: "guide-section-4", name: "Bridge", startTime: 91, endTime: 124, memo: "일렉 패드성 톤" },
          { id: "guide-section-5", name: "Chorus", startTime: 125, endTime: 160, memo: "회중 유도" },
        ],
        highlights: ["첫 곡이라 과하게 몰아가지 않기", "후렴 두 번째 반복부터 다이내믹 넓히기"],
        partNotes: [
          { id: "guide-part-1", part: "보컬", note: "후렴 화음은 두 번째 반복부터 얇게 넣기" },
          { id: "guide-part-2", part: "일렉", note: "인트로는 딜레이 1/8D 느낌으로 공간 만들기" },
          { id: "guide-part-3", part: "드럼", note: "브릿지 전까지 심벌 사용 절제" },
        ],
        links: [],
        sheetLinks: [{ id: "guide-sheet-1", label: "코드 악보", url: "https://example.com/sheet" }],
        imageLinks: [{ id: "guide-image-1", label: "코드 악보 이미지", url: imageUrl }],
      },
      {
        id: "guide-song-2",
        title: "나는 예배자입니다",
        description: "고백적인 분위기로 회중이 함께 부르기 좋은 곡입니다.",
        youtubeUrl: "https://youtu.be/WC8LKCbumyE",
        youtubeVideoId: "WC8LKCbumyE",
        originalKey: "F",
        practiceKey: "F",
        bpm: 68,
        capo: 0,
        chordForm: "F",
        sections: [
          { id: "guide-section-6", name: "Verse", startTime: 0, endTime: 42 },
          { id: "guide-section-7", name: "Chorus", startTime: 43, endTime: 84 },
          { id: "guide-section-8", name: "Bridge", startTime: 85, endTime: 112 },
          { id: "guide-section-9", name: "Chorus", startTime: 113, endTime: 150 },
        ],
        highlights: ["후렴은 너무 빠르게 올리지 않기"],
        partNotes: [{ id: "guide-part-4", part: "건반", note: "패드 중심으로 공간 유지" }],
        links: [],
        sheetLinks: [],
        imageLinks: [],
      },
      {
        id: "guide-song-3",
        title: "Way Maker",
        description: "선포하는 분위기로 마무리하는 곡입니다.",
        youtubeUrl: "https://youtu.be/QOI-kywg2yA",
        youtubeVideoId: "QOI-kywg2yA",
        originalKey: "E",
        practiceKey: "E",
        bpm: 70,
        capo: 4,
        chordForm: "C",
        sections: [
          { id: "guide-section-10", name: "Intro", startTime: 0, endTime: 16 },
          { id: "guide-section-11", name: "Verse", startTime: 17, endTime: 58 },
          { id: "guide-section-12", name: "Chorus", startTime: 59, endTime: 100 },
          { id: "guide-section-13", name: "Bridge", startTime: 101, endTime: 145 },
          { id: "guide-section-14", name: "Chorus", startTime: 146, endTime: 190 },
        ],
        highlights: ["마지막 후렴은 회중 소리를 충분히 듣기"],
        partNotes: [{ id: "guide-part-5", part: "베이스", note: "브릿지부터 옥타브로 열기" }],
        links: [],
        sheetLinks: [],
        imageLinks: [],
      },
    ],
  };
}
