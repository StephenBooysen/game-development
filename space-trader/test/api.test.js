'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createApp } = require('../app');
const { GameService } = require('../src/game/GameService');

let server;
let services;
let base;
let tmp;

test.before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'void-merchant-'));
  services = await createApp({ dataDir: path.join(tmp, 'data'), logDir: path.join(tmp, 'logs') });
  const { app } = services;
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://localhost:${server.address().port}`;
});

test.after(() => {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

async function call(method, url, body) {
  const res = await fetch(base + url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
}

const commander = { name: 'Api Test', difficulty: 'normal', skills: { navigation: 6, battle: 6, trading: 6 } };

test('serves the client and security headers', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Void Merchant/);
  assert.ok(res.headers.get('content-security-policy'));
});

test('setup data describes difficulties, skills and the starter ship', async () => {
  const { status, body } = await call('GET', '/api/setup');
  assert.equal(status, 200);
  assert.equal(body.difficulties.length, 3);
  assert.equal(body.skills.pool, 18);
  assert.equal(body.starterShip.name, 'Kestrel Mk I');
});

test('creating a game validates input', async () => {
  assert.equal((await call('POST', '/api/games', { ...commander, difficulty: 'nightmare' })).status, 400);
  assert.equal((await call('POST', '/api/games', { ...commander, name: '' })).status, 400);
  const over = await call('POST', '/api/games', { ...commander, skills: { navigation: 10, battle: 10, trading: 10 } });
  assert.equal(over.status, 400);
  assert.match(over.body.error, /18 skill points/);
});

test('a game can be created, loaded, traded in and retired', async () => {
  const created = await call('POST', '/api/games', commander);
  assert.equal(created.status, 201);
  const id = created.body.game.id;
  assert.equal(created.body.game.status, 'docked');

  const loaded = await call('GET', `/api/games/${id}`);
  assert.equal(loaded.body.game.header.credits, 1000);

  const summary = await call('GET', `/api/games/${id}/summary`);
  assert.deepEqual(summary.body.summary, { id, name: 'Api Test', day: 1, status: 'docked', location: 'Solace', over: false });

  const bought = await call('POST', `/api/games/${id}/market/buy`, { good: 'food', qty: 3 });
  assert.equal(bought.status, 200);
  assert.equal(bought.body.game.header.cargoUsed, 3);
  assert.match(bought.body.notice.text, /Bought 3 t Food/);

  const bad = await call('POST', `/api/games/${id}/market/buy`, { good: 'food', qty: 'lots' });
  assert.equal(bad.status, 400);

  const wrongState = await call('POST', `/api/games/${id}/combat`, { action: 'fire' });
  assert.equal(wrongState.status, 409);

  const retired = await call('POST', `/api/games/${id}/retire`, {});
  assert.equal(retired.body.game.status, 'over');
  assert.equal(retired.body.game.over.ending, 'retired');

  const hof = await call('GET', '/api/halloffame');
  assert.ok(hof.body.entries.some((e) => e.gameId === id && e.ending === 'Retired'));
});

test('rapid concurrent actions are applied one at a time', async () => {
  const { body } = await call('POST', '/api/games', commander);
  const id = body.game.id;
  const results = await Promise.all(Array.from({ length: 8 }, () => call('POST', `/api/games/${id}/market/buy`, { good: 'water', qty: 1 })));
  assert.ok(results.every((r) => r.status === 200));
  const { body: after } = await call('GET', `/api/games/${id}`);
  assert.equal(after.game.header.cargoUsed, 8);
});

test('restarting on an existing data folder keeps saved games', async () => {
  const { body } = await call('POST', '/api/games', commander);
  const id = body.game.id;
  // A second start-up against the same data folder must not fail.
  const restarted = new GameService({ dataService: services.games.dataService, cache: { get: async () => null, put: async () => {}, delete: async () => {} } });
  await restarted.init();
  assert.equal((await restarted.view(id)).id, id);
});

test('unknown games and routes return 404', async () => {
  assert.equal((await call('GET', '/api/games/00000000-0000-4000-8000-000000000000')).status, 404);
  assert.equal((await call('GET', '/api/games/not-a-uuid')).status, 404);
  assert.equal((await call('GET', '/api/nope')).status, 404);
});

test('restoring a saved game state recreates the game on the server', async () => {
  const created = await call('POST', '/api/games', commander);
  assert.equal(created.status, 201);
  const state = created.body.state;
  assert.ok(state);
  assert.equal(state.name, 'Api Test');

  // Modify state slightly to verify restoration applies the client state
  const modifiedState = { ...state, credits: 42000, day: 5 };
  const restored = await call('POST', '/api/games/restore', { state: modifiedState });
  assert.equal(restored.status, 200);
  assert.equal(restored.body.game.header.credits, 42000);
  assert.equal(restored.body.game.day, 5);
  assert.equal(restored.body.state.credits, 42000);
});

test('restores game progress seamlessly after server redeployment / wiped data', async () => {
  // 1. Create a game and do some trades on the current server
  const created = await call('POST', '/api/games', commander);
  const id = created.body.game.id;
  const bought = await call('POST', `/api/games/${id}/market/buy`, { good: 'food', qty: 2 });
  assert.equal(bought.status, 200);

  // This is what the browser saves to localStorage
  const savedState = bought.body.state;
  assert.equal(savedState.cargo.food.qty, 2);

  // 2. Simulate redeployment: spin up an entirely new server instance with a clean/fresh data directory
  const freshTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'void-merchant-fresh-'));
  const freshServices = await createApp({ dataDir: path.join(freshTmp, 'data'), logDir: path.join(freshTmp, 'logs'), instanceName: 'fresh-redeploy' });
  const freshServer = await new Promise((resolve) => {
    const s = freshServices.app.listen(0, () => resolve(s));
  });
  const freshBase = `http://localhost:${freshServer.address().port}`;

  try {
    // 3. On the new server, the old game ID returns 404 (data was not carried over)
    const checkRes = await fetch(`${freshBase}/api/games/${id}`);
    assert.equal(checkRes.status, 404);

    // 4. Client restores from localStorage
    const restoreRes = await fetch(`${freshBase}/api/games/restore`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state: savedState })
    });
    assert.equal(restoreRes.status, 200);
    const restoredBody = await restoreRes.json();
    assert.equal(restoredBody.game.id, id);
    assert.equal(restoredBody.game.header.cargoUsed, 2);
    assert.equal(restoredBody.state.cargo.food.qty, 2);

    // 5. Player continues playing on the new deployment: sell cargo
    const sellRes = await fetch(`${freshBase}/api/games/${id}/market/sell`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ good: 'food', qty: 2 })
    });
    assert.equal(sellRes.status, 200);
    const sellBody = await sellRes.json();
    assert.equal(sellBody.game.header.cargoUsed, 0);
  } finally {
    freshServer.close();
    fs.rmSync(freshTmp, { recursive: true, force: true });
  }
});

test('validates restored game payloads and rejects invalid states', async () => {
  assert.equal((await call('POST', '/api/games/restore', {})).status, 400);
  assert.equal((await call('POST', '/api/games/restore', { state: null })).status, 400);
  assert.equal((await call('POST', '/api/games/restore', { state: { id: 'bad-uuid', name: 'Tester' } })).status, 400);
  assert.equal((await call('POST', '/api/games/restore', { state: { id: '00000000-0000-4000-8000-000000000000', name: '', difficulty: 'normal' } })).status, 400);
});

test('nooblyjs-core service dashboards stay behind a login by default', async () => {
  const res = await fetch(`${base}/services/dataservice/api/games`, { redirect: 'manual' });
  assert.notEqual(res.status, 200);
});
