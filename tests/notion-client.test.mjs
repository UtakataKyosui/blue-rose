import assert from 'node:assert/strict';
import test from 'node:test';
import { convert } from '../notion-client.ts';

test('YouTube bookmark becomes an external video block', () => {
  const url = 'https://www.youtube.com/watch?v=abc123DEF45';
  assert.deepEqual(convert({ id: 'a', type: 'bookmark', bookmark: { url, caption: [] } }), {
    id: 'a',
    type: 'video',
    video: { type: 'external', external: { url }, caption: [] },
  });
});

test('other bookmark and embed blocks become linked paragraphs', () => {
  const url = 'https://example.com/lyrics';
  for (const type of ['bookmark', 'embed', 'link_preview']) {
    assert.deepEqual(convert({ id: 'b', type, [type]: { url, caption: [] } }), {
      id: 'b',
      type: 'paragraph',
      paragraph: { rich_text: [{ plain_text: url, href: url }] },
    });
  }
});

test('other blocks pass through unchanged', () => {
  const block = { id: 'c', type: 'paragraph', paragraph: { rich_text: [] } };
  assert.equal(convert(block), block);
});
