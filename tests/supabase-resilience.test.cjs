const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../assets/js/supabase.js'), 'utf8');
const origin = 'https://sxdsfklllilhdyuamvvg.supabase.co';
const sign = origin + '/storage/v1/object/sign/docmap/photo.webp';
function setup(fetch, timers = {}) {
  const window = { fetch, supabase: { createClient: (_, __, options) => ({ options }) } };
  vm.runInNewContext(source, { window, URL, Response, AbortController, DOMException, setTimeout, clearTimeout, ...timers });
  return window.LuriaNetwork.fetch;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('image signing is capped at three and all queued requests finish', async () => {
  let active = 0, max = 0;
  const pending = [];
  const fetch = setup(async () => {
    active++; max = Math.max(active, max);
    await new Promise(resolve => pending.push(resolve)); active--;
    return new Response('{"signedURL":"test"}');
  });
  const jobs = Array.from({ length: 12 }, () => fetch(sign, { method: 'POST' }));
  await tick(); assert.equal(pending.length, 3);
  for (let i = 0; i < 12; i++) { pending.shift()(); await tick(); }
  const responses = await Promise.all(jobs);
  assert.equal(max, 3); assert.equal(responses.length, 12);
  assert.equal(await responses[0].text(), '{"signedURL":"test"}');
});
test('three service failures pause queued signing and recovery remains possible', async () => {
  let calls = 0, time = 100000;
  const window = { fetch: async () => { calls++; return new Response('{}', { status: calls <= 3 ? 503 : 200 }); }, supabase: { createClient() {} } };
  vm.runInNewContext(source, { window, URL, Response, AbortController, DOMException, setTimeout, clearTimeout, Date: { now: () => time } });
  const fetch = window.LuriaNetwork.fetch;
  for (let i = 0; i < 3; i++) await fetch(sign, { method: 'POST' });
  await assert.rejects(fetch(sign, { method: 'POST' }), /temporariamente/);
  assert.equal(calls, 3);
  time += 15001;
  assert.equal((await fetch(sign, { method: 'POST' })).status, 200);
});
test('an aborted queued request never reaches the network', async () => {
  const releases = []; let calls = 0;
  const fetch = setup(async () => { calls++; await new Promise(r => releases.push(r)); return new Response('{}'); });
  const first = Array.from({ length: 3 }, () => fetch(sign, { method: 'POST' }));
  const abort = new AbortController();
  const queued = fetch(sign, { method: 'POST', signal: abort.signal });
  abort.abort(); await assert.rejects(queued);
  await tick(); releases.forEach(r => r()); await Promise.all(first);
  assert.equal(calls, 3);
});
test('read timeout aborts the actual request without replay', async () => {
  let expire, calls = 0;
  const fetch = setup((_, init) => { calls++; return new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason))); }, { setTimeout: cb => { expire = cb; return 1; }, clearTimeout() {} });
  const request = fetch(origin + '/rest/v1/profiles');
  expire(); await assert.rejects(request, { name: 'TimeoutError' }); assert.equal(calls, 1);
});
test('writes, uploads and Edge Functions preserve the original fetch options', async () => {
  const seen = [];
  const fetch = setup(async (url, options) => { seen.push(options); return new Response('{}'); });
  const options = { method: 'POST', body: '{}' };
  for (const path of ['/rest/v1/flashcard_reviews', '/storage/v1/object/docmap/file.webp', '/functions/v1/question-factory-perplexity-audit']) await fetch(origin + path, options);
  assert.equal(seen.length, 3); seen.forEach(item => assert.equal(item, options));
});
test('authorization failures do not trip service circuit', async () => {
  let calls = 0;
  const fetch = setup(async () => { calls++; return new Response('{}', { status: 403 }); });
  for (let i = 0; i < 5; i++) assert.equal((await fetch(sign, { method: 'POST' })).status, 403);
  assert.equal(calls, 5);
});
const app = fs.readFileSync(require('node:path').join(__dirname, '../assets/js/app.js'), 'utf8');
function permissionFixture(result, cached) {
  const sb = { auth: { getSession: async () => ({ data: { session: { user: { id: 'test' } } } }) }, rpc: async () => result };
  const env = { sb, readFreshCache: () => cached, adminCacheKey: id => id, entitlementsCacheKey: id => id, writeTimedCache() {}, console: { warn() {} } };
  const start = app.indexOf('function essentialEntitlementsFallback()');
  vm.runInNewContext(app.slice(start, app.indexOf('function temFeature', start)), env);
  const adminStart = app.indexOf('async function verificarAcessoAdmin()');
  vm.runInNewContext(app.slice(adminStart, app.indexOf('async function prepararAdminNavigation', adminStart)), env);
  return env;
}
test('permission outage is unknown without cache, preserving a previous valid plan when present', async () => {
  const unavailable = { data: null, error: { message: 'Failed to fetch' } };
  const missing = permissionFixture(unavailable, null);
  assert.equal(await missing.verificarAcessoAdmin(), null);
  assert.equal((await missing.carregarEntitlements()).source, 'fallback');
  const previous = { plan: 'plus', source: 'subscription', features: {} };
  assert.equal(await permissionFixture(unavailable, previous).carregarEntitlements(), previous);
  assert.equal(await permissionFixture(unavailable, true).verificarAcessoAdmin(), true);
});
test('confirmed denial overrides previously cached administrative access', async () => {
  assert.equal(await permissionFixture({ data: false, error: null }, true).verificarAcessoAdmin(), false);
});
test('Studyrats reuses the in-flight read instead of overlapping realtime and timer requests', async () => {
  const source = fs.readFileSync(require('node:path').join(__dirname, '../assets/js/studyrats.js'), 'utf8');
  let finish, calls = 0;
  const env = { document: { getElementById: () => ({}) }, window: { supabaseClient: { rpc: () => { calls++; return new Promise(r => { finish = r; }); } } }, sharedStudyratsRenderRecentRanking() {}, sharedStudyratsRender() {}, console };
  vm.runInNewContext(source.slice(source.indexOf('let sharedStudyratsLoadPending'), source.indexOf('function sharedStudyratsRender(){')), env);
  const first = env.sharedStudyratsLoad(), second = env.sharedStudyratsLoad();
  assert.equal(first, second); assert.equal(calls, 1);
  finish({ data: [], error: null }); await first;
  const next = env.sharedStudyratsLoad(); assert.equal(calls, 2); finish({ data: [], error: null }); await next;
});
