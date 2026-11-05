import { createRequire } from "node:module";

type RichText = { plain_text: string; href?: string | null };
type Block = { id: string; type: string; [key: string]: unknown };
type Client = {
  blocks: {
    children: {
      list: (args: { block_id: string; start_cursor?: string }) => Promise<{
        results: Block[];
        has_more: boolean;
        next_cursor: string | null;
      }>;
    };
  };
  [key: string]: unknown;
};

const LINK_BLOCKS = new Set(["bookmark", "embed", "link_preview"]);
const YOUTUBE_HOST = /(?:^|\.)(?:youtube(?:-nocookie)?\.com|youtu\.be)$/u;

const isYouTube = (url: string): boolean =>
  YOUTUBE_HOST.test(URL.parse(url)?.hostname ?? "");

const rich = (text: string, href?: string): RichText[] => [
  { plain_text: text, href },
];

// Blume は bookmark / embed を未対応ブロックとして捨てるため、
// YouTube は video ブロック、それ以外は URL へのリンク段落に置き換える。
export const convert = (block: Block): Block => {
  if (!LINK_BLOCKS.has(block.type)) {
    return block;
  }
  const data = block[block.type] as { url?: string; caption?: RichText[] };
  const url = data?.url;
  if (!url) {
    return block;
  }
  if (isYouTube(url)) {
    return {
      id: block.id,
      type: "video",
      video: { type: "external", external: { url }, caption: data.caption ?? [] },
    };
  }
  const label = data.caption?.map((node) => node.plain_text).join("") || url;
  return {
    id: block.id,
    type: "paragraph",
    paragraph: { rich_text: rich(label, url) },
  };
};

/** `@notionhq/client` の Client を、リンク系ブロックを変換する形で包む。 */
export const createNotionClient = (): Client => {
  const { Client: NotionClient } = createRequire(import.meta.url)(
    "@notionhq/client",
  ) as { Client: new (config: { auth?: string }) => Client };
  const client = new NotionClient({ auth: process.env.NOTION_TOKEN });
  const list = client.blocks.children.list.bind(client.blocks.children);
  client.blocks.children.list = async (args) => {
    const page = await list(args);
    return { ...page, results: page.results.map(convert) };
  };
  return client;
};
