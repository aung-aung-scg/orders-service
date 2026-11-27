import type { MetadataRoute } from "next";
import { publicUrl } from "@/lib/public-origin";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/platform", "/kitchen", "/menu", "/tables", "/table-sessions", "/reservations", "/orders", "/products", "/t/",
        "/booking/", "/login", "/my-reservations", "/r/*/booking/", "/r/*/login", "/r/*/change-password",
        "/r/*/my-reservations", "/r/*/kitchen", "/r/*/menu", "/r/*/tables", "/r/*/table-sessions", "/r/*/reservations",
      ],
    },
    sitemap: publicUrl("/sitemap.xml").href,
  };
}
