import type { MetadataRoute } from "next";

const siteUrl = "https://setlistlab.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/account",
          "/account/",
          "/settings",
          "/settings/",
          "/notifications",
          "/notifications/",
          "/admin",
          "/admin/",
          "/auth",
          "/auth/",
          "/onboarding",
          "/onboarding/",
          "/import",
          "/import/",
          "/guide/demo",
          "/guide/demo/",
          "/api",
          "/api/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
