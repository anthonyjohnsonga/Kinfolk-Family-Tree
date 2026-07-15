import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { db } from './db.js';

// db.ts requires DATABASE_URL at import time; the fake client below means no
// connection is ever opened, so a placeholder value is enough.
process.env.DATABASE_URL ||= 'postgresql://kinfolk:test_only@localhost:5432/kinfolk';
const { syncRelationships, syncLifeEvents } = await import('./relationships.js');

type Call = { model: string; method: string; args: unknown };

// Records every Prisma-style call instead of touching a database. person.count
// answers membership checks from validIds; everything else is a no-op.
function fakeClient(validIds: string[] = []) {
  const calls: Call[] = [];
  const model = (name: string) =>
    new Proxy(
      {},
      {
        get: (_target, method: string) => async (args: unknown) => {
          calls.push({ model: name, method, args });
        },
      },
    );
  const tx = {
    parentRelationship: model('parentRelationship'),
    partnership: model('partnership'),
    siblingRelationship: model('siblingRelationship'),
    lifeEvent: model('lifeEvent'),
  };
  const client = {
    person: {
      count: async (args: { where: { id: { in: string[] } } }) => {
        calls.push({ model: 'person', method: 'count', args });
        return args.where.id.in.filter((id) => validIds.includes(id)).length;
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(tx),
  };
  return { client: client as unknown as typeof db, calls };
}

const utc = (value: string) => new Date(`${value}T00:00:00Z`);

test('rejects the same sibling selected twice', async () => {
  const { client } = fakeClient(['a']);
  await assert.rejects(
    syncRelationships(
      'p',
      't',
      {
        name: 'x',
        siblings: [
          { personId: 'a', type: 'full' },
          { personId: 'a', type: 'half' },
        ],
      },
      client,
    ),
    /only once/,
  );
});

test('rejects the same partner selected twice', async () => {
  const { client } = fakeClient(['a']);
  await assert.rejects(
    syncRelationships(
      'p',
      't',
      {
        name: 'x',
        partnerships: [
          { personId: 'a', status: 'divorced' },
          { personId: 'a', status: 'married' },
        ],
      },
      client,
    ),
    /only once/,
  );
});

test('rejects relating a person to themselves', async () => {
  const { client } = fakeClient(['p']);
  await assert.rejects(
    syncRelationships('p', 't', { name: 'x', parentIds: ['p'] }, client),
    /themselves/,
  );
  await assert.rejects(
    syncRelationships(
      'p',
      't',
      { name: 'x', partnerships: [{ personId: 'p', status: 'married' }] },
      client,
    ),
    /themselves/,
  );
});

test('rejects relatives that are not in the same tree', async () => {
  const { client } = fakeClient([]);
  await assert.rejects(
    syncRelationships('p', 't', { name: 'x', parentIds: ['stranger'] }, client),
    /same tree/,
  );
});

test('a body without relationships only clears parent links', async () => {
  const { client, calls } = fakeClient();
  await syncRelationships('p', 't', { name: 'x' }, client);
  assert.deepEqual(calls, [
    { model: 'parentRelationship', method: 'deleteMany', args: { where: { childId: 'p' } } },
  ]);
});

test('replaces parent links from parentIds', async () => {
  const { client, calls } = fakeClient(['a', 'b']);
  await syncRelationships('p', 't', { name: 'x', parentIds: ['a', 'b'] }, client);
  assert.deepEqual(
    calls.filter((call) => call.model === 'parentRelationship'),
    [
      { model: 'parentRelationship', method: 'deleteMany', args: { where: { childId: 'p' } } },
      {
        model: 'parentRelationship',
        method: 'createMany',
        args: {
          data: [
            { treeId: 't', parentId: 'a', childId: 'p' },
            { treeId: 't', parentId: 'b', childId: 'p' },
          ],
        },
      },
    ],
  );
});

test('replaces all partnerships with sorted pairs and parsed dates', async () => {
  const { client, calls } = fakeClient(['a', 'z']);
  await syncRelationships(
    'm',
    't',
    {
      name: 'x',
      partnerships: [
        {
          personId: 'z',
          status: 'divorced',
          marriageDate: '1980-06-15',
          divorceDate: '1995-02-01',
        },
        { personId: 'a', status: 'married', marriageDate: '1998-09-09' },
      ],
    },
    client,
  );
  assert.deepEqual(
    calls.filter((call) => call.model === 'partnership'),
    [
      {
        model: 'partnership',
        method: 'deleteMany',
        args: { where: { OR: [{ partnerAId: 'm' }, { partnerBId: 'm' }] } },
      },
      {
        model: 'partnership',
        method: 'createMany',
        args: {
          data: [
            {
              treeId: 't',
              partnerAId: 'm',
              partnerBId: 'z',
              status: 'divorced',
              marriageDate: utc('1980-06-15'),
              divorceDate: utc('1995-02-01'),
            },
            {
              treeId: 't',
              partnerAId: 'a',
              partnerBId: 'm',
              status: 'married',
              marriageDate: utc('1998-09-09'),
              divorceDate: null,
            },
          ],
        },
      },
    ],
  );
});

test('an empty partnerships array clears every partnership', async () => {
  const { client, calls } = fakeClient();
  await syncRelationships('m', 't', { name: 'x', partnerships: [] }, client);
  assert.deepEqual(
    calls.filter((call) => call.model === 'partnership'),
    [
      {
        model: 'partnership',
        method: 'deleteMany',
        args: { where: { OR: [{ partnerAId: 'm' }, { partnerBId: 'm' }] } },
      },
    ],
  );
});

test('legacy single partnerId upserts without deleting other partnerships', async () => {
  const { client, calls } = fakeClient(['z']);
  await syncRelationships(
    'm',
    't',
    { name: 'x', partnerId: 'z', partnershipStatus: 'married', marriageDate: '2001-05-20' },
    client,
  );
  const partnershipCalls = calls.filter((call) => call.model === 'partnership');
  assert.equal(partnershipCalls.length, 1);
  assert.deepEqual(partnershipCalls[0], {
    model: 'partnership',
    method: 'upsert',
    args: {
      where: { partnerAId_partnerBId: { partnerAId: 'm', partnerBId: 'z' } },
      create: {
        treeId: 't',
        partnerAId: 'm',
        partnerBId: 'z',
        status: 'married',
        marriageDate: utc('2001-05-20'),
      },
      update: { status: 'married', marriageDate: utc('2001-05-20') },
    },
  });
});

test('replaces sibling links with sorted pairs and types', async () => {
  const { client, calls } = fakeClient(['a']);
  await syncRelationships(
    'p',
    't',
    { name: 'x', siblings: [{ personId: 'a', type: 'half' }] },
    client,
  );
  assert.deepEqual(
    calls.filter((call) => call.model === 'siblingRelationship'),
    [
      {
        model: 'siblingRelationship',
        method: 'deleteMany',
        args: { where: { OR: [{ siblingAId: 'p' }, { siblingBId: 'p' }] } },
      },
      {
        model: 'siblingRelationship',
        method: 'createMany',
        args: { data: [{ treeId: 't', siblingAId: 'a', siblingBId: 'p', type: 'half' }] },
      },
    ],
  );
});

test('legacy single siblingId upserts without clearing other links', async () => {
  const { client, calls } = fakeClient(['z']);
  await syncRelationships('p', 't', { name: 'x', siblingId: 'z', siblingType: 'step' }, client);
  const siblingCalls = calls.filter((call) => call.model === 'siblingRelationship');
  assert.equal(siblingCalls.length, 1);
  assert.equal(siblingCalls[0].method, 'upsert');
});

test('syncLifeEvents does nothing when lifeEvents is absent', async () => {
  const { client, calls } = fakeClient();
  await syncLifeEvents('p', { name: 'x' }, client);
  assert.deepEqual(calls, []);
});

test('syncLifeEvents replaces events and trims text fields', async () => {
  const { client, calls } = fakeClient();
  await syncLifeEvents(
    'p',
    {
      name: 'x',
      lifeEvents: [
        { type: 'residence', date: '1975-01-01', place: '  Savannah  ', description: '   ' },
      ],
    },
    client,
  );
  assert.deepEqual(calls, [
    { model: 'lifeEvent', method: 'deleteMany', args: { where: { personId: 'p' } } },
    {
      model: 'lifeEvent',
      method: 'createMany',
      args: {
        data: [
          {
            personId: 'p',
            type: 'residence',
            date: utc('1975-01-01'),
            place: 'Savannah',
            description: null,
          },
        ],
      },
    },
  ]);
});
