import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'node_modules/blume/bin/blume.mjs');
const run = async (cwd, args, env) => {
  try {
    return await exec(process.execPath, [cli, ...args], {
      cwd, env, timeout: 180_000, maxBuffer: 8 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(`${error.message}\n${error.stdout}\n${error.stderr}`, { cause: error });
  }
};
const files = async (dir) => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(
  async (entry) => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
))).flat();

test('Notion content builds with draft isolation, navigation, search, and durable images', { timeout: 360_000 }, async () => {
  const dir = await mkdtemp(join(root, '.test-site-'));
  const env = {
    ...process.env,
    NOTION_DATABASE_ID: '00000000000000000000000000000001',
    NOTION_TOKEN: 'fixture-token-never-a-real-secret',
    NOTION_PUBLISHED_VALUE: 'Done',
    SITE_URL: 'https://blue-rose.example',
    ASTRO_TELEMETRY_DISABLED: '1',
  };
  try {
    // Use the real site config and real Notion renderer, replacing only the API
    // client and media transport. No test switch exists in production config.
    await writeFile(join(dir, 'blume.config.ts'), `
      import config, { notionOptions } from ${JSON.stringify(join(root, 'blume.config.ts'))};
      import { custom, filesystem } from 'blume/sources';
      import { notionSource } from 'blume/sources/notion.ts';
      import { client, fetchImpl } from ${JSON.stringify(join(root, 'tests/notion-fixture.mjs'))};
      if (notionOptions.prefix !== 'notion' || notionOptions.publishedValue !== 'Done') {
        throw new Error('Unexpected Notion publication settings');
      }
      export default {
        ...config,
        seo: { og: { enabled: false } },
        content: { sources: [
          filesystem({ root: ${JSON.stringify(join(root, 'docs'))} }),
          custom(notionSource({ ...notionOptions, name: 'notion', client, fetchImpl })),
        ] },
      };
    `);
    await writeFile(join(dir, 'components.ts'), `
      import { defineComponents } from 'blume';
      export default defineComponents({
        mdx: { Bookmark: ${JSON.stringify(join(root, 'components/Bookmark.astro'))} },
      });
    `);
    await run(dir, ['build'], env);
    const dist = join(dir, 'dist');
    const outputFiles = await files(dist);
    const html = await readFile(join(dist, 'notion/guides/setup/index.html'), 'utf8');
    for (const text of ['Fixture heading', 'Published body marker', 'Fixture list item', 'Fixture callout', 'Fixture toggle', 'Nested toggle content', 'Fixture caption']) {
      assert.ok(html.includes(text), `Rendered content missing: ${text}`);
    }
    assert.ok(html.includes('answer'), 'Code block renders');
    assert.ok(!html.includes('https://fixture.invalid/'), 'Signed image URL must be replaced');
    assert.ok(outputFiles.some(file => file.includes('blume-assets') && file.endsWith('.png')), 'Image downloaded into build');
    assert.ok(outputFiles.includes(join(dist, 'notion/fallback-title/index.html')), 'Title fallback slug');
    assert.ok(!outputFiles.some(file => file.includes('draft-marker')), 'No public draft route or raw Markdown');
    const home = await readFile(join(dist, 'index.html'), 'utf8');
    assert.ok(!home.includes('トップへ戻る'), 'No back-to-top footer');
    assert.ok(home.indexOf('First fixture article') < home.indexOf('Second fixture article'), 'Order controls navigation');
    assert.ok(home.includes('/notion/guides/setup'), 'Notion page in sidebar');
    const search = await readFile(join(dist, 'blume-search.json'), 'utf8');
    assert.ok(search.includes('Published body marker'), 'Published body indexed');
    const sitemap = (await Promise.all(outputFiles.filter(file => /sitemap.*\.xml$/.test(file)).map(file => readFile(file, 'utf8')))).join('\n');
    assert.ok(sitemap.includes('https://blue-rose.example/notion/guides/setup'), 'Published page in canonical sitemap');
    for (const text of [home, html, search, sitemap]) {
      assert.ok(!text.includes('Private draft marker'), 'Draft title stays private');
      assert.ok(!text.includes('draft-marker'), 'Draft URL stays private');
      assert.ok(!text.includes(env.NOTION_TOKEN), 'Token stays out of output');
    }
    // The exact same data must be available in an explicit draft preview.
    await run(dir, ['build', '--preview'], env);
    const draft = await readFile(join(dist, 'notion/draft-marker/index.html'), 'utf8');
    assert.ok(draft.includes('Private draft marker'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
