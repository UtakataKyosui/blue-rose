// This client is injected only by the isolated test site's config. Production
// always uses @notionhq/client and never imports this module.
const rich = (text) => [{ plain_text: text }];
const page = (id, title, slug, status, order) => ({
  id,
  last_edited_time: '2026-11-03T00:00:00.000Z',
  properties: {
    Name: { type: 'title', title: rich(title) },
    Description: { type: 'rich_text', rich_text: rich(`${title} description`) },
    Slug: { type: 'rich_text', rich_text: rich(slug) },
    Status: { type: 'status', status: { name: status } },
    Order: { type: 'number', number: order },
  },
});
const block = (id, type, value, has_children = false) => ({
  id, type, has_children, [type]: value,
});
const pages = [
  page('later', 'Second fixture article', 'guides/second', 'Done', 20),
  page('published', 'First fixture article', 'guides/setup', 'Done', 10),
  page('draft', 'Private draft marker', 'draft-marker', 'In progress', 30),
  page('fallback', 'Fallback Title', '', 'Done', 40),
];
export const client = {
  databases: {
    retrieve: async () => ({ data_sources: [{ id: 'fixture-source' }] }),
  },
  dataSources: {
    // Exercise pagination: the draft is deliberately on the second page.
    query: async ({ start_cursor }) => start_cursor
      ? { results: pages.slice(2), has_more: false, next_cursor: null }
      : { results: pages.slice(0, 2), has_more: true, next_cursor: 'next' },
  },
  blocks: {
    children: {
      list: async ({ block_id }) => ({
        has_more: false,
        results: block_id === 'published' ? [
          block('heading', 'heading_2', { rich_text: rich('Fixture heading') }),
          block('text', 'paragraph', { rich_text: rich('Published body marker with literal {braces} and <tags>.') }),
          block('code', 'code', { rich_text: rich('const answer = 42;'), language: 'javascript' }),
          block('list', 'bulleted_list_item', { rich_text: rich('Fixture list item') }),
          block('callout', 'callout', { rich_text: rich('Fixture callout') }),
          block('toggle', 'toggle', { rich_text: rich('Fixture toggle') }, true),
          block('image', 'image', { type: 'file', file: { url: 'https://fixture.invalid/signed.png?expires=soon' }, caption: rich('Fixture caption') }),
        ] : block_id === 'toggle' ? [
          block('nested', 'paragraph', { rich_text: rich('Nested toggle content') }),
        ] : [block(`body-${block_id}`, 'paragraph', { rich_text: rich(`Body for ${block_id}`) })],
      }),
    },
  },
};
export const fetchImpl = async () => new Response(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5WQAAAAASUVORK5CYII=', 'base64'),
  { headers: { 'content-type': 'image/png' } },
);
