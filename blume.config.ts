import { defineConfig } from "blume";
import { notion, contentful } from "blume/sources";

export default defineConfig({
  title: "Utakata Blue Rose",
  description: "Documentation powered by Blume.",
  content: {
    sources: [
      // Pages from a Notion database. Reads NOTION_TOKEN from the environment.
      notion({
        database: "your-database-id",
        prefix: "notion",
      }),
      // Entries of a Contentful content type. Reads CONTENTFUL_ACCESS_TOKEN
      // from the environment.
      contentful({
        space: "your-space-id",
        contentType: "doc",
        prefix: "contentful",
      }),
    ],
  },
});
