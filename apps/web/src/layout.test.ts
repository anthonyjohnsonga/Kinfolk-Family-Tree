import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Person } from './types';
import { buildConnectorPath, computeGenerations, focusPeople, groupFamilies } from './layout';

const person = (id: string, overrides: Partial<Person> = {}): Person => ({
  id,
  name: id,
  maidenName: null,
  birthDate: null,
  birthPlace: null,
  deathDate: null,
  deathPlace: null,
  bio: null,
  parentLinks: [],
  partnershipsA: [],
  partnershipsB: [],
  siblingLinksA: [],
  siblingLinksB: [],
  lifeEvents: [],
  ...overrides,
});
const parentLink = (parentId: string, childId: string) => ({
  parentId,
  childId,
  type: 'biological',
});
const rows = (people: Person[]) =>
  computeGenerations(people).map(([generation, members]) => [
    generation,
    members.map((member) => member.id),
  ]);

test('children render one generation below their parents', () => {
  const people = [
    person('grandma'),
    person('mom', { parentLinks: [parentLink('grandma', 'mom')] }),
    person('kid', { parentLinks: [parentLink('mom', 'kid')] }),
  ];
  assert.deepEqual(rows(people), [
    [0, ['grandma']],
    [1, ['mom']],
    [2, ['kid']],
  ]);
});

test('a partner without recorded parents joins their partner’s generation', () => {
  const marriage = {
    partnerAId: 'mom',
    partnerBId: 'stepdad',
    status: 'married',
    marriageDate: null,
    divorceDate: null,
  };
  const people = [
    person('grandma'),
    person('mom', { parentLinks: [parentLink('grandma', 'mom')], partnershipsA: [marriage] }),
    person('stepdad', { partnershipsB: [marriage] }),
  ];
  assert.deepEqual(rows(people), [
    [0, ['grandma']],
    [1, ['mom', 'stepdad']],
  ]);
});

test('sibling links pull people onto the same generation', () => {
  const link = { siblingAId: 'adopted', siblingBId: 'kid', type: 'adopted' };
  const people = [
    person('mom'),
    person('kid', { parentLinks: [parentLink('mom', 'kid')], siblingLinksB: [link] }),
    person('adopted', { siblingLinksA: [link] }),
  ];
  assert.deepEqual(rows(people), [
    [0, ['mom']],
    [1, ['kid', 'adopted']],
  ]);
});

test('a parent cycle does not hang and still returns every person', () => {
  const people = [
    person('a', { parentLinks: [parentLink('b', 'a')] }),
    person('b', { parentLinks: [parentLink('a', 'b')] }),
  ];
  const everyone = computeGenerations(people).flatMap(([, members]) =>
    members.map((member) => member.id),
  );
  assert.deepEqual(everyone.sort(), ['a', 'b']);
});

test('focus keeps ancestors, descendants, and co-parents, hiding other branches', () => {
  const people = [
    person('grandma'),
    person('mom', { parentLinks: [parentLink('grandma', 'mom')] }),
    person('uncle', { parentLinks: [parentLink('grandma', 'uncle')] }),
    person('dad'),
    person('kid', { parentLinks: [parentLink('mom', 'kid'), parentLink('dad', 'kid')] }),
    person('stranger'),
  ];
  const shown = focusPeople(people, 'mom')
    .map((member) => member.id)
    .sort();
  assert.deepEqual(shown, ['dad', 'grandma', 'kid', 'mom']);
});

test('focus keeps partners of every shown person', () => {
  const marriage = {
    partnerAId: 'a',
    partnerBId: 'b',
    status: 'married',
    marriageDate: null,
    divorceDate: null,
  };
  const people = [
    person('a', { partnershipsA: [marriage] }),
    person('b', { partnershipsB: [marriage] }),
    person('stranger'),
  ];
  const shown = focusPeople(people, 'a')
    .map((member) => member.id)
    .sort();
  assert.deepEqual(shown, ['a', 'b']);
});

test('focus with an unknown id shows everyone', () => {
  const people = [person('a'), person('b')];
  assert.equal(focusPeople(people, 'missing'), people);
});

test('groups children by their exact parent set', () => {
  const people = [
    person('a'),
    person('b'),
    person('kid1', { parentLinks: [parentLink('a', 'kid1'), parentLink('b', 'kid1')] }),
    person('kid2', { parentLinks: [parentLink('b', 'kid2'), parentLink('a', 'kid2')] }),
    person('kid3', { parentLinks: [parentLink('a', 'kid3')] }),
  ];
  const families = groupFamilies(people).map((family) => ({
    parentIds: family.parentIds,
    children: family.children.map((child) => child.id),
  }));
  assert.deepEqual(families, [
    { parentIds: ['a', 'b'], children: ['kid1', 'kid2'] },
    { parentIds: ['a'], children: ['kid3'] },
  ]);
});

test('single parent connector drops straight to the child bus', () => {
  const path = buildConnectorPath([{ x: 100, y: 50 }], [{ x: 100, y: 150 }], null);
  assert.equal(path, 'M 100 50 V 115 M 100 115 H 100 M 100 115 V 150');
});

test('two unpaired parents join at their midpoint before the bus', () => {
  const path = buildConnectorPath(
    [
      { x: 0, y: 50 },
      { x: 200, y: 50 },
    ],
    [{ x: 100, y: 150 }],
    null,
  );
  assert.equal(
    path,
    'M 0 50 V 85 H 100 M 200 50 V 85 H 100 M 100 85 V 115 M 100 115 H 100 M 100 115 V 150',
  );
});

test('a couple connector starts from the couple line anchor', () => {
  const path = buildConnectorPath(
    [
      { x: 0, y: 50 },
      { x: 200, y: 50 },
    ],
    [
      { x: 60, y: 150 },
      { x: 140, y: 150 },
    ],
    { x: 90, y: 40 },
  );
  assert.equal(path, 'M 90 40 V 115 M 60 115 H 140 M 60 115 V 150 M 140 115 V 150');
});

test('the bus keeps a minimum gap when children sit close to parents', () => {
  const path = buildConnectorPath([{ x: 100, y: 100 }], [{ x: 100, y: 110 }], null);
  assert.equal(path, 'M 100 100 V 115.6 M 100 115.6 H 100 M 100 115.6 V 110');
});
