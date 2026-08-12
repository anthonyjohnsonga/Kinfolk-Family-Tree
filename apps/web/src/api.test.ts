import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api } from './api';

type Call = { url: string; init: RequestInit };
function stubFetch(response: Response) {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return response;
  }) as unknown as typeof fetch;
  return calls;
}
const header = (call: Call, name: string) =>
  (call.init.headers as Record<string, string> | undefined)?.[name];

test('a request with a body announces JSON', async () => {
  const calls = stubFetch(new Response('{"ok":true}', { headers: { 'Content-Type': 'json' } }));
  await api('/api/trees', { method: 'POST', body: '{"name":"Kin"}' });
  assert.equal(header(calls[0], 'Content-Type'), 'application/json');
});

test('a bodyless request omits Content-Type so Fastify does not reject it', async () => {
  // Fastify answers 400 FST_ERR_CTP_EMPTY_JSON_BODY when a request claims a
  // JSON body and sends none, which is how sign-out and DELETE used to fail.
  const calls = stubFetch(new Response(null, { status: 204 }));
  await api('/api/auth/logout', { method: 'POST' });
  assert.equal(header(calls[0], 'Content-Type'), undefined);
  await api('/api/people/p1', { method: 'DELETE' });
  assert.equal(header(calls[1], 'Content-Type'), undefined);
});

test('a caller can still set its own headers', async () => {
  const calls = stubFetch(new Response(null, { status: 204 }));
  await api('/api/photos/x', { method: 'PATCH', body: '{}', headers: { 'X-Test': '1' } });
  assert.equal(header(calls[0], 'Content-Type'), 'application/json');
  assert.equal(header(calls[0], 'X-Test'), '1');
});
