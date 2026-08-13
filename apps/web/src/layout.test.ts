import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ForeignPerson, Person, Tree } from './types';
import {
  buildConnectorPath,
  computeGenerations,
  focusPeople,
  groupFamilies,
  peopleWithForeign,
} from './layout';

const person = (id: string, overrides: Partial<Person> = {}): Person => ({
  id,
  name: id,
  maidenName: null,
  birthDate: null,
  birthDateToken: null,
  birthPlace: null,
  deathDate: null,
  deathDateToken: null,
  deathPlace: null,
  bio: null,
  parentLinks: [],
  childLinks: [],
  partnershipsA: [],
  partnershipsB: [],
  siblingLinksA: [],
  siblingLinksB: [],
  lifeEvents: [],
  photos: [],
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
    marriageDateToken: null,
    divorceDate: null,
    divorceDateToken: null,
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
    marriageDateToken: null,
    divorceDate: null,
    divorceDateToken: null,
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

const foreign = (id: string, overrides: Partial<ForeignPerson> = {}): ForeignPerson => ({
  id,
  name: id,
  treeId: 'other-tree',
  treeName: 'Other Family',
  birthDateToken: null,
  deathDateToken: null,
  ...overrides,
});
const asTree = (people: Person[], foreignPeople: ForeignPerson[] = []): Tree => ({
  id: 't',
  name: 'Tree',
  backgroundStyle: 'botanical',
  backgroundColor: '#faf9f3',
  treeColor: '#76927b',
  accentColor: '#d7a74c',
  people,
  foreignPeople,
});

test('a tree with no cross-tree links keeps its own people untouched', () => {
  const people = [person('a')];
  assert.equal(peopleWithForeign(asTree(people)), people);
});

test('a foreign parent becomes a ghost the child can sit below', () => {
  const people = [person('kid', { parentLinks: [parentLink('outsider', 'kid')] })];
  const merged = peopleWithForeign(asTree(people, [foreign('outsider')]));
  assert.deepEqual(
    merged.map((p) => p.id),
    ['kid', 'outsider'],
  );
  assert.deepEqual(rows(merged), [
    [0, ['outsider']],
    [1, ['kid']],
  ]);
});

test('a foreign child inherits the parent edge held by this tree', () => {
  // The row lives on the local parent, so the ghost has to be given the link
  // for the generation and connector code to see the family at all.
  const people = [person('mom', { childLinks: [parentLink('mom', 'faraway')] })];
  const merged = peopleWithForeign(asTree(people, [foreign('faraway')]));
  const ghost = merged.find((p) => p.id === 'faraway')!;
  assert.deepEqual(ghost.parentLinks, [parentLink('mom', 'faraway')]);
  assert.deepEqual(rows(merged), [
    [0, ['mom']],
    [1, ['faraway']],
  ]);
  assert.deepEqual(groupFamilies(merged), [{ parentIds: ['mom'], children: [ghost] }]);
});

test('a ghost carries only the detail its stub held', () => {
  const merged = peopleWithForeign(
    asTree([], [foreign('x', { name: 'Ada', birthDateToken: '1880', deathDateToken: '~1950' })]),
  );
  const ghost = merged[0];
  assert.equal(ghost.name, 'Ada');
  assert.equal(ghost.birthDateToken, '1880');
  assert.equal(ghost.deathDateToken, '~1950');
  assert.deepEqual([ghost.photos, ghost.lifeEvents, ghost.childLinks], [[], [], []]);
  assert.equal(ghost.bio, null);
});

test('a foreign partner is pulled onto their partner generation row', () => {
  // union() in computeGenerations only merges ids it knows, so this proves the
  // ghost is a real array entry rather than a dangling reference.
  const people = [
    person('grandma'),
    person('mom', { parentLinks: [parentLink('grandma', 'mom')] }),
    person('dad', {
      partnershipsA: [
        {
          partnerAId: 'dad',
          partnerBId: 'inlaw',
          status: 'married',
          marriageDate: null,
          marriageDateToken: null,
          divorceDate: null,
          divorceDateToken: null,
        },
      ],
    }),
  ];
  const merged = peopleWithForeign(asTree(people, [foreign('inlaw')]));
  const generation = rows(merged).find(([, ids]) => (ids as string[]).includes('inlaw'));
  assert.deepEqual(generation, [0, ['grandma', 'dad', 'inlaw']]);
});
