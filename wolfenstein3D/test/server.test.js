import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readdir } from 'node:fs/promises';
import { app } from '../server.js';

test('Express serves the game page, every script it needs and the health endpoint', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  const health = await fetch(`${base}/api/health`);
  assert.deepEqual(await health.json(), { ok: true });

  const scripts = [
    'app.js', 'game.js', 'maps.js', 'raycast.js', 'render.js', 'textures.js', 'floors.js', 'input.js', 'sound.js',
    'storage.js', 'scores.js', 'savegame.js', 'editor.js', 'editor-core.js', 'map-file.js',
  ];
  const files = [['/', 'text/html'], ['/editor.html', 'text/html'], ['/style.css', 'text/css'], ...scripts.map((name) => [`/${name}`, 'javascript'])];
  for (const [file, contentType] of files) {
    const response = await fetch(`${base}${file}`);
    assert.equal(response.status, 200, file);
    assert.ok(response.headers.get('content-type').includes(contentType), file);
    assert.ok(response.headers.get('content-security-policy').includes("script-src 'self'"));
    assert.ok((await response.text()).length > 0);
  }

  // The maps folder is listed in play order, and each .map file is plain text.
  const list = await (await fetch(`${base}/maps/index.json`)).json();
  const onDisk = (await readdir(new URL('../maps/', import.meta.url))).filter((name) => name.endsWith('.map')).sort();
  assert.deepEqual(list, onDisk);
  assert.ok(list.length >= 3);
  const mapFile = await fetch(`${base}/maps/${list[0]}`);
  assert.ok(mapFile.headers.get('content-type').startsWith('text/plain'));
  assert.match(await mapFile.text(), /^name: /);
  assert.equal((await fetch(`${base}/maps/README.md`)).status, 200, 'the folder guide is readable too');

  // Files outside public/ and maps/ must not be reachable.
  for (const hidden of ['/server.js', '/package.json', '/test/game.test.js', '/missing-file', '/maps/../server.js', '/maps/missing.map']) {
    assert.equal((await fetch(`${base}${hidden}`)).status, 404, hidden);
  }
});

test('the pages work under the Content Security Policy: no inline scripts or styles', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const [page, script] of [['index.html', 'app.js'], ['editor.html', 'editor.js']]) {
    const html = await readFile(new URL(`../public/${page}`, import.meta.url), 'utf8');
    assert.ok(html.includes(`<script type="module" src="${script}"></script>`), page);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)/, `no inline <script> in ${page}`);
    assert.doesNotMatch(html, /\sstyle=|<style/, `no inline styles in ${page}`);
    assert.doesNotMatch(html, /\son\w+=/, `no inline event handlers in ${page}`);
  }
});

test('every script in public/ only imports files that exist', async () => {
  const { readFile } = await import('node:fs/promises');
  const dir = new URL('../public/', import.meta.url);
  const names = await readdir(dir);
  for (const name of names.filter((file) => file.endsWith('.js'))) {
    const source = await readFile(new URL(name, dir), 'utf8');
    for (const [, target] of source.matchAll(/from '\.\/([^']+)'/g)) {
      assert.ok(names.includes(target), `${name} imports ${target}`);
    }
  }
});
