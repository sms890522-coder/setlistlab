import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.GUIDE_SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const outputDir = path.join(process.cwd(), "public", "guide");

const screenshots = [
  { pagePath: "/guide/demo/create-setlist", target: "create-setlist", fileName: "create-setlist.png" },
  { pagePath: "/guide/demo/create-setlist", target: "song-form-editor", fileName: "song-form-editor.png" },
  { pagePath: "/guide/demo/view-setlist", target: "view-setlist", fileName: "view-setlist.png" },
  { pagePath: "/guide/demo/youtube-practice", target: "youtube-practice", fileName: "youtube-practice.png" },
  { pagePath: "/guide/demo/youtube-practice", target: "loop-control", fileName: "loop-control.png" },
  { pagePath: "/guide/demo/youtube-practice", target: "playback-speed", fileName: "playback-speed.png" },
  { pagePath: "/guide/demo/youtube-practice", target: "song-form-navigation", fileName: "song-form-navigation.png" },
  { pagePath: "/guide/demo/youtube-practice", target: "score-image", fileName: "score-image.png" },
  { pagePath: "/guide/demo/pdf-export", target: "pdf-export", fileName: "pdf-export.png" },
  { pagePath: "/guide/demo/pdf-export", target: "pdf-customize", fileName: "pdf-customize.png" },
  { pagePath: "/guide/demo/team-dashboard", target: "team-dashboard", fileName: "team-dashboard.png" },
  { pagePath: "/guide/demo/team-dashboard", target: "team-invite", fileName: "team-invite.png" },
  { pagePath: "/guide/demo/team-chat", target: "team-chat", fileName: "team-chat.png" },
  { pagePath: "/guide/demo/team-chat", target: "team-notice", fileName: "team-notice.png" },
  { pagePath: "/guide/demo/team-calendar", target: "team-calendar", fileName: "team-calendar.png" },
  { pagePath: "/guide/demo/team-calendar", target: "availability-check", fileName: "availability-check.png" },
  { pagePath: "/guide/demo/practice-tools", target: "tuner", fileName: "tuner.png" },
  { pagePath: "/guide/demo/practice-tools", target: "metronome", fileName: "metronome.png" },
] as const;

test.use({
  viewport: { width: 390, height: 844 },
  colorScheme: "light",
});

test.describe("guide screenshots", () => {
  test.beforeAll(async () => {
    await mkdir(outputDir, { recursive: true });
  });

  for (const screenshot of screenshots) {
    test(`capture ${screenshot.fileName}`, async ({ page }) => {
      await page.goto(`${baseUrl}${screenshot.pagePath}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => undefined);
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
        path: path.join(outputDir, screenshot.fileName),
        animations: "disabled",
      });
    });
  }
});
