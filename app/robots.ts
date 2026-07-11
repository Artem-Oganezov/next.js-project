import type { MetadataRoute } from "next";

function getSiteUrl(): string {
  return process.env.APP_URL?.trim() || "http://localhost:3000";
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/", "/api/", "/reset-password", "/verify-email"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
