import type { MetadataRoute } from "next";

const siteUrl = "https://www.routefit.co.kr";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/guide`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
