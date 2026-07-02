import type { MetadataRoute } from "next";

const siteUrl = "https://setlistlab.vercel.app";

const publicRoutes = [
  "",
  "/setlists",
  "/songs",
  "/teams",
  "/tools/tuner",
  "/guide",
  "/whats-new",
  "/login",
  "/signup",
  "/contact",
  "/terms",
  "/privacy",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // TODO: 공개 공유 콘티만 서버에서 조회해 /s/[shareSlug] 항목을 추가한다.
  return publicRoutes.map((route) => {
    if (route === "") {
      return {
        url: `${siteUrl}${route}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 1,
      };
    }

    if (route === "/guide") {
      return {
        url: `${siteUrl}${route}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.5,
      };
    }

    return {
      url: `${siteUrl}${route}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    };
  });
}
