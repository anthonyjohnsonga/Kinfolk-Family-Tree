import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { db } from './db.js';

// db.ts requires DATABASE_URL at import time; the fake client below means no
// connection is ever opened, so a placeholder value is enough.
process.env.DATABASE_URL ||= 'postgresql://kinfolk:test_only@localhost:5432/kinfolk';
const { searchPeople, searchTerms, personSearchWhere } = await import('./search.js');
const { MAX_PEOPLE_SEARCH_RESULTS } = await import('./contract.js');

type Row = {
  id: string;
  name: string;
  maidenName: string | null;
  treeId: string;
  birthDateToken: string | null;
  deathDateToken: string | null;
  tree: { name: string };
};

const row = (id: string, name: string, treeName: string): Row => ({
  id,
  name,
  maidenName: null,
  treeId: `tree-${treeName}`,
  birthDateToken: null,
  deathDateToken: null,
  tree: { name: treeName },
});

// Records the findMany arguments instead of querying, and answers with whatever
// rows the test hands it.
function fakeClient(rows: Row[] = []) {
  const calls: unknown[] = [];
  const client = {
    person: {
      findMany: async (args: unknown) => {
        calls.push(args);
        return rows;
      },
    },
  };
  return { client: client as unknown as typeof db, calls };
}

test('splits a query into terms and ignores stray whitespace', () => {
  assert.deepEqual(searchTerms('  ada   glasgow '), ['ada', 'glasgow']);
});

test('caps the number of terms', () => {
  assert.equal(searchTerms('a b c d e f g h i j k').length, 8);
});

test('requires every term to match, in any recognisable field', () => {
  const where = personSearchWhere(['ada']);
  assert.equal(where.AND.length, 1);
  assert.deepEqual(
    where.AND[0].OR.map((clause) => Object.keys(clause)[0]),
    ['name', 'maidenName', 'birthPlace', 'deathPlace'],
  );
  assert.deepEqual(where.AND[0].OR[0], { name: { contains: 'ada', mode: 'insensitive' } });
});

test('an empty query matches nobody without touching the database', async () => {
  const { client, calls } = fakeClient([row('1', 'Ada', 'Roots')]);
  assert.deepEqual(await searchPeople('   ', undefined, client), []);
  assert.equal(calls.length, 0);
});

test('returns hits from every tree, labelled with the tree they live in', async () => {
  const { client } = fakeClient([row('1', 'Ada Bell', 'Roots'), row('2', 'Ada Ford', 'Branches')]);
  const results = await searchPeople('ada', undefined, client);
  assert.deepEqual(
    results.map((person) => [person.name, person.treeName]),
    [
      ['Ada Bell', 'Roots'],
      ['Ada Ford', 'Branches'],
    ],
  );
  // The nested tree relation is flattened away, never passed through as-is.
  assert.ok(!('tree' in results[0]));
});

test('defaults to the result cap and never exceeds it', async () => {
  const { client, calls } = fakeClient();
  await searchPeople('ada', undefined, client);
  await searchPeople('ada', MAX_PEOPLE_SEARCH_RESULTS + 100, client);
  await searchPeople('ada', 5, client);
  assert.deepEqual(
    calls.map((args) => (args as { take: number }).take),
    [MAX_PEOPLE_SEARCH_RESULTS, MAX_PEOPLE_SEARCH_RESULTS, 5],
  );
});
