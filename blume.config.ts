import { defineConfig } from "blume";
import { orama } from "blume/search";
import { filesystem, notion } from "blume/sources";

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

export default defineConfig({
  title: "Utakata Blue-Rose",
  description: "日常の気づきと、ものづくりの記録。",
  search: orama(),
  theme: { accent: "blue" },
  deployment: {
    site: process.env.SITE_URL || "https://blume-blog.vercel.app",
  },
  content: {
    sources: [
      filesystem({
        root: "docs",
      }),
      // Pages from a Notion database. Reads NOTION_TOKEN from the environment.
      notion({
        database: notionDatabaseId,
        prefix: "notion",
        // Match Notion's default statuses. Other nonempty statuses are drafts.
        publishedValue: process.env.NOTION_PUBLISHED_VALUE || "Done",
        // Dev only; production updates are picked up by the rebuild workflow.
        pollInterval: 60,
      }),
    ],
  },
});
