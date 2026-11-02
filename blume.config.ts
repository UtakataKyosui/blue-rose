import { defineConfig } from "blume";
import { filesystem,notion } from "blume/sources";

const notionDatabaseId = process.env.NOTION_DATASOURCE_ID;

if (!notionDatabaseId) 
  throw new Error("NOTION_DATASOURCE_ID environment variable is not set.");

export default defineConfig({
  title: "Utakata Blue-Rose",
  description: "Documentation powered by Blume.",
  content: {
    sources: [
      filesystem({
        root: "docs"
      }),
      // Pages from a Notion database. Reads NOTION_TOKEN from the environment.
      notion({
        database: notionDatabaseId,
        prefix: "notion",
      })
    ],
  },
});
