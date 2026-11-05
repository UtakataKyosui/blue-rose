import { defineConfig } from "blume";
import { orama } from "blume/search";
import { custom, filesystem } from "blume/sources";
import { notionSource } from "blume/sources/notion.ts";
import { createNotionClient } from "./notion-client";

// Blume loads .env.local before evaluating this file. Keep the old variable as
// an alias so existing deployments continue working; both must be database IDs.
const notionDatabaseId = (
  process.env.NOTION_DATABASE_ID ?? process.env.NOTION_DATASOURCE_ID
)?.trim();

if (!notionDatabaseId) {
  throw new Error(
    "Set NOTION_DATABASE_ID to the database ID (not a data source or view ID). See README.md.",
  );
}

// Pages from a Notion database. Reads NOTION_TOKEN from the environment.
// notion() は client を受け付けないため、bookmark / embed を YouTube は動画、
// それ以外はリンクとして取り込むラッパーを notionSource に渡す。
export const notionOptions = {
  database: notionDatabaseId,
  prefix: "notion",
  // Match Notion's default statuses. Other nonempty statuses are drafts.
  publishedValue: process.env.NOTION_PUBLISHED_VALUE || "Done",
};

export default defineConfig({
  title: "Utakata Blue-Rose",
  description: "日常の気づきと、ものづくりの記録。",
  search: orama(),
  theme: { accent: "blue" },
  navigation: {
    sidebar: { display: "group" },
  },
  markdown: {
    externalLinks: true,
    imageZoom: true,
    headingAnchors: true,
    code: { theme: { light: "github-light", dark: "vesper" } },
  },
  deployment: {
    site: process.env.SITE_URL || "https://blume-blog.vercel.app",
  },
  seo: {
    og: {
      enabled: true,
      palette: {
        background: "#0b0f1a",
        foreground: "#e8ecf4",
        muted: "#8b95ab",
        border: "#1f2740",
        accent: "oklch(0.72 0.14 250)",
      },
      fonts: [{ name: "Noto Sans JP", weight: [400, 700] }],
    },
    rss: { enabled: true, types: ["blog"], limit: 50 },
    sitemap: true,
    robots: true,
    structuredData: true,
  },
  agents: {
    llmsTxt: {
      enabled: true,
      details:
        "日常の気づきと、個人開発で学んだことを書き留めた個人ブログ。記事は /notion/ 配下にある。",
    },
    contentSignals: { search: true, aiInput: true, aiTrain: true },
  },
  content: {
    // Notion の行は type を持てないため、既定の type を blog にして RSS と BlogPosting の対象にする。
    defaultType: "blog",
    sources: [
      filesystem({
        root: "docs",
      }),
      // Pages from a Notion database. Reads NOTION_TOKEN from the environment.
      custom(notionSource({ ...notionOptions, name: "notion", client: createNotionClient() })),
    ],
  },
});
