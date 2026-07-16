import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Person } from './types';
import { searchPeople } from './search';

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
const names = (people: Person[]) => people.map((match) => match.name);

test('an empty query returns everyone sorted by name', () => {
  const people = [person('z', { name: 'Zoe' }), person('a', { name: 'Ann' })];
  assert.deepEqual(names(searchPeople(people, '')), ['Ann', 'Zoe']);
  assert.deepEqual(names(searchPeople(people, '   ')), ['Ann', 'Zoe']);
});

test('matches names case-insensitively', () => {
  const people = [person('1', { name: 'Alice Jones' }), person('2', { name: 'Bob Bell' })];
  assert.deepEqual(names(searchPeople(people, 'aLiCe')), ['Alice Jones']);
});

test('matches maiden names and places', () => {
  const people = [
    person('1', { name: 'Alice Jones', maidenName: 'Smith' }),
    person('2', { name: 'Bob Bell', birthPlace: 'Savannah, Georgia' }),
    person('3', { name: 'Carl Ray', deathPlace: 'Macon' }),
  ];
  assert.deepEqual(names(searchPeople(people, 'smith')), ['Alice Jones']);
  assert.deepEqual(names(searchPeople(people, 'savannah')), ['Bob Bell']);
  assert.deepEqual(names(searchPeople(people, 'macon')), ['Carl Ray']);
});

test('every term must match somewhere', () => {
  const people = [
    person('1', { name: 'Alice Jones', birthPlace: 'Savannah' }),
    person('2', { name: 'Alice Bell', birthPlace: 'Atlanta' }),
  ];
  assert.deepEqual(names(searchPeople(people, 'alice savannah')), ['Alice Jones']);
  assert.deepEqual(names(searchPeople(people, 'alice nowhere')), []);
});
