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
          "/onboarding",
          "/onboarding/",
          "/import",
          "/import/",
          "/api",
          "/api/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
