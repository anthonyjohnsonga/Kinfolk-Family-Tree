import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { db } from './db.js';

// db.ts requires DATABASE_URL at import time; the fake client below means no
// connection is ever opened, so a placeholder value is enough.
process.env.DATABASE_URL ||= 'postgresql://kinfolk:test_only@localhost:5432/kinfolk';
const { listSources, searchTerms, sourceSearchWhere, sourceData, sourcePatch } =
  await import('./sources.js');
const { MAX_SOURCE_RESULTS } = await import('./contract.js');

type Row = {
  id: string;
  title: string;
  author: string | null;
  publication: string | null;
  repository: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const row = (id: string, title: string): Row => ({
  id,
  title,
  author: null,
  publication: null,
  repository: null,
  notes: null,
  createdAt: new Date('2026-08-16T00:00:00.000Z'),
  updatedAt: new Date('2026-08-16T00:00:00.000Z'),
});

// Records the findMany arguments instead of querying, and answers with whatever
// rows the test hands it.
function fakeClient(rows: Row[] = []) {
  const calls: unknown[] = [];
  const client = {
    source: {
      findMany: async (args: unknown) => {
        calls.push(args);
        return rows;
      },
    },
  };
  return { client: client as unknown as typeof db, calls };
}

test('splits a query into terms and ignores stray whitespace', () => {
  assert.deepEqual(searchTerms('  1880   census '), ['1880', 'census']);
});

test('requires every term to match, in any recognisable field', () => {
  const where = sourceSearchWhere(['census']);
  assert.equal(where.AND.length, 1);
  assert.deepEqual(
    where.AND[0].OR.map((clause) => Object.keys(clause)[0]),
    ['title', 'author', 'publication', 'repository', 'notes'],
  );
  assert.deepEqual(where.AND[0].OR[0], { title: { contains: 'census', mode: 'insensitive' } });
});

test('a blank query lists the library rather than filtering it', async () => {
  const { client, calls } = fakeClient([row('1', 'Family Bible')]);
  const results = await listSources('   ', undefined, client);
  assert.equal(results.length, 1);
  // No where clause at all, as opposed to one that matches nothing.
  assert.equal((calls[0] as { where?: unknown }).where, undefined);
});

test('dates cross the wire as ISO strings, not Date objects', async () => {
  const { client } = fakeClient([row('1', 'Death certificate')]);
  const [source] = await listSources('', undefined, client);
  assert.equal(source.createdAt, '2026-08-16T00:00:00.000Z');
  assert.equal(typeof source.updatedAt, 'string');
});

test('defaults to the result cap and never exceeds it', async () => {
  const { client, calls } = fakeClient();
  await listSources('census', undefined, client);
  await listSources('census', MAX_SOURCE_RESULTS + 100, client);
  await listSources('census', 5, client);
  assert.deepEqual(
    calls.map((args) => (args as { take: number }).take),
    [MAX_SOURCE_RESULTS, MAX_SOURCE_RESULTS, 5],
  );
});

test('creating trims the title and stores blank optional fields as null', () => {
  const data = sourceData({ title: '  1880 Census  ', author: '   ', notes: 'Page torn' });
  assert.equal(data.title, '1880 Census');
  assert.equal(data.author, null);
  assert.equal(data.publication, null);
  assert.equal(data.notes, 'Page torn');
});

test('a patch touches only the fields it mentions', () => {
  // The absent keys must stay absent: sending null would wipe values the
  // caller never asked to change.
  assert.deepEqual(sourcePatch({ notes: 'Reread the original' }), {
    notes: 'Reread the original',
  });
  // An explicit blank still means "clear this field".
  assert.deepEqual(sourcePatch({ author: '  ' }), { author: null });
  assert.deepEqual(sourcePatch({}), {});
});
