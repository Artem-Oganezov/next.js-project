import type { MetadataRoute } from "next";

function getSiteUrl(): string {
  return process.env.APP_URL?.trim() || "http://localhost:3000";
}

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const lastModified = new Date();

  return [
    {
      url: siteUrl,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/privacy`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${siteUrl}/terms`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];
}
