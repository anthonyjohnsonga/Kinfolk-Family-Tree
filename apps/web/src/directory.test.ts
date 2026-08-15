import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDirectory, countCrossTreeLinks, mergeCandidates, toPicked } from './directory';
import type { ForeignPerson, Person, Tree } from './types';

const person = (id: string, name: string): Person => ({
  id,
  name,
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
});

const foreign = (id: string, name: string, treeName: string): ForeignPerson => ({
  id,
  name,
  treeId: `tree-${treeName}`,
  treeName,
  birthDateToken: null,
  deathDateToken: null,
});

const tree = (people: Person[], foreignPeople: ForeignPerson[] = []): Tree => ({
  id: 'tree-roots',
  name: 'Roots',
  backgroundStyle: 'botanical',
  backgroundColor: '#faf9f3',
  treeColor: '#76927b',
  accentColor: '#d7a74c',
  people,
  foreignPeople,
});

const picked = (id: string, treeId: string) => ({
  id,
  name: id,
  maidenName: null,
  treeId,
  treeName: treeId,
  birthDateToken: null,
  deathDateToken: null,
});

test('a loaded person is tagged with the tree they were loaded from', () => {
  const result = toPicked(person('a', 'Ada'), 'tree-roots', 'Roots');
  assert.equal(result.treeId, 'tree-roots');
  assert.equal(result.treeName, 'Roots');
});

test('the directory can name both local people and the stubs from other trees', () => {
  const directory = buildDirectory(tree([person('a', 'Ada')], [foreign('b', 'Bea', 'Branches')]));
  assert.equal(directory.get('a')?.treeName, 'Roots');
  assert.equal(directory.get('b')?.treeName, 'Branches');
  // A stub carries no maiden name, but the shape still has the field.
  assert.equal(directory.get('b')?.maidenName, null);
});

test('a tree with no cross-tree links still builds a directory', () => {
  const directory = buildDirectory(tree([person('a', 'Ada')]));
  assert.equal(directory.size, 1);
});

test('a tree that keeps to itself has no cross-tree links to warn about', () => {
  const people = [person('a', 'Ada'), person('b', 'Cal')];
  people[1].parentLinks = [{ parentId: 'a', childId: 'b', type: 'biological' }];
  assert.equal(countCrossTreeLinks(tree(people)), 0);
});

test('every kind of edge that leaves the tree is counted once', () => {
  const ada = person('a', 'Ada');
  // A parent, a child, a partner, and a sibling, each living somewhere else.
  ada.parentLinks = [{ parentId: 'away-1', childId: 'a', type: 'biological' }];
  ada.childLinks = [{ parentId: 'a', childId: 'away-2', type: 'biological' }];
  ada.partnershipsA = [
    {
      partnerAId: 'a',
      partnerBId: 'away-3',
      status: 'married',
      marriageDate: null,
      marriageDateToken: null,
      divorceDate: null,
      divorceDateToken: null,
    },
  ];
  ada.siblingLinksB = [{ siblingAId: 'away-4', siblingBId: 'a', type: 'full' }];
  assert.equal(countCrossTreeLinks(tree([ada])), 4);
});

test('local matches come first and server hits follow', () => {
  const results = mergeCandidates([picked('a', 'tree-roots')], [picked('z', 'tree-branches')], []);
  assert.deepEqual(
    results.map((item) => item.id),
    ['a', 'z'],
  );
});

test('a server hit that is really a local person is not listed twice', () => {
  const results = mergeCandidates([picked('a', 'tree-roots')], [picked('a', 'tree-roots')]);
  assert.equal(results.length, 1);
});

test('excluded ids never appear, whichever side they came from', () => {
  const results = mergeCandidates(
    [picked('a', 'tree-roots'), picked('b', 'tree-roots')],
    [picked('c', 'tree-branches')],
    ['b', 'c'],
  );
  assert.deepEqual(
    results.map((item) => item.id),
    ['a'],
  );
});
