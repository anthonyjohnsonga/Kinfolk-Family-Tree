import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Person } from './types';
import { describeRelationship } from './relationship';

const person = (id: string, overrides: Partial<Person> = {}): Person => ({
  id,
  name: id.charAt(0).toUpperCase() + id.slice(1),
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
const child = (id: string, ...parents: string[]) =>
  person(id, {
    parentLinks: parents.map((parentId) => ({ parentId, childId: id, type: 'biological' })),
  });

// Four generations: greatgrandma's children are grandma and grandaunt.
// Grandma and grandpa's children are mom, uncle; halfaunt is grandma's only.
const family = [
  person('greatgrandma'),
  person('grandpa'),
  child('grandma', 'greatgrandma'),
  child('grandaunt', 'greatgrandma'),
  child('mom', 'grandma', 'grandpa'),
  child('uncle', 'grandma', 'grandpa'),
  child('halfaunt', 'grandma'),
  child('momcousin', 'grandaunt'),
  child('kid', 'mom'),
  child('cousin', 'uncle'),
  child('cousinskid', 'cousin'),
  child('secondcousin', 'momcousin'),
];
const describe = (a: string, b: string) => describeRelationship(family, a, b);

test('direct line: parents, grandchildren, great-grandparents', () => {
  assert.equal(describe('kid', 'mom'), "Mom is Kid's parent.");
  assert.equal(describe('grandma', 'kid'), "Kid is Grandma's grandchild.");
  assert.equal(describe('kid', 'greatgrandma'), "Greatgrandma is Kid's great-grandparent.");
});

test('siblings and half-siblings by shared parents', () => {
  assert.equal(
    describe('mom', 'uncle'),
    'Mom and Uncle are siblings (through Grandma and Grandpa).',
  );
  assert.equal(
    describe('mom', 'halfaunt'),
    'Mom and Halfaunt are half-siblings (through Grandma).',
  );
});

test('aunts, uncles, nieces, and nephews', () => {
  assert.equal(
    describe('kid', 'uncle'),
    "Uncle is Kid's aunt or uncle (through Grandma and Grandpa).",
  );
  assert.equal(
    describe('uncle', 'kid'),
    "Kid is Uncle's niece or nephew (through Grandma and Grandpa).",
  );
  assert.equal(describe('cousin', 'greatgrandma'), "Greatgrandma is Cousin's great-grandparent.");
});

test('cousins with degrees and removal', () => {
  assert.equal(
    describe('kid', 'cousin'),
    'Kid and Cousin are first cousins (through Grandma and Grandpa).',
  );
  assert.equal(
    describe('kid', 'cousinskid'),
    'Kid and Cousinskid are first cousins once removed (through Grandma and Grandpa).',
  );
  assert.equal(
    describe('kid', 'secondcousin'),
    'Kid and Secondcousin are second cousins (through Greatgrandma).',
  );
});

test('direct partnerships outrank blood relationships', () => {
  const marriage = {
    partnerAId: 'a',
    partnerBId: 'b',
    status: 'married',
    marriageDate: null,
    divorceDate: null,
  };
  const divorce = { ...marriage, partnerAId: 'a', partnerBId: 'c', status: 'divorced' };
  const people = [
    person('parent'),
    { ...child('a', 'parent'), partnershipsA: [marriage, divorce] },
    { ...child('b', 'parent'), partnershipsB: [marriage] },
    { ...person('c'), partnershipsB: [divorce] },
  ];
  assert.equal(describeRelationship(people, 'a', 'b'), 'A and B are spouses.');
  assert.equal(describeRelationship(people, 'a', 'c'), 'A and C are former spouses.');
});

test('explicit sibling links cover step and adopted siblings', () => {
  const link = { siblingAId: 'a', siblingBId: 'b', type: 'step' };
  const people = [
    person('a', { siblingLinksA: [link] }),
    person('b', { siblingLinksB: [link] }),
    person('c'),
  ];
  assert.equal(describeRelationship(people, 'a', 'b'), 'A and B are step-siblings.');
  assert.equal(
    describeRelationship(people, 'a', 'c'),
    'No relationship is recorded between A and C.',
  );
});
