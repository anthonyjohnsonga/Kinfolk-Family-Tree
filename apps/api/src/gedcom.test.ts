import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGedcom, parseGedcom, type GedcomPerson } from './gedcom.js';

const day = (value: string) => new Date(`${value}T00:00:00Z`);
const base = {
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
  lifeEvents: [],
};

test('a divorced and remarried family survives an export/import round trip', () => {
  const marriage1 = {
    partnerAId: 'alice',
    partnerBId: 'bob',
    status: 'divorced',
    marriageDate: day('1980-06-15'),
    divorceDate: day('1995-02-01'),
  };
  const marriage2 = {
    partnerAId: 'alice',
    partnerBId: 'carl',
    status: 'married',
    marriageDate: day('1998-09-09'),
    divorceDate: null,
  };
  const people: GedcomPerson[] = [
    {
      ...base,
      id: 'alice',
      name: 'Alice Marie Jones',
      maidenName: 'Smith',
      birthDate: day('1955-03-12'),
      birthPlace: 'Atlanta, Georgia',
      bio: 'Loved gardening.\nKept every letter.',
      partnershipsA: [marriage1, marriage2],
      lifeEvents: [
        { type: 'residence', date: day('1975-01-01'), place: 'Savannah', description: null },
        { type: 'military', date: null, place: null, description: 'Army nurse' },
      ],
    },
    { ...base, id: 'bob', name: 'Bob Jones', partnershipsB: [marriage1] },
    { ...base, id: 'carl', name: 'Carl Bell', partnershipsB: [marriage2] },
    {
      ...base,
      id: 'dana',
      name: 'Dana Jones',
      parentLinks: [
        { parentId: 'alice', childId: 'dana' },
        { parentId: 'bob', childId: 'dana' },
      ],
      siblingLinksA: [{ siblingAId: 'dana', siblingBId: 'evan', type: 'half' }],
    },
    {
      ...base,
      id: 'evan',
      name: 'Evan Bell',
      deathDate: day('2020-11-30'),
      parentLinks: [
        { parentId: 'alice', childId: 'evan' },
        { parentId: 'carl', childId: 'evan' },
      ],
    },
  ];

  const parsed = parseGedcom(buildGedcom('Jones Family', people));

  assert.equal(parsed.name, 'Jones Family');
  assert.equal(parsed.people.length, 5);
  const alice = parsed.people[0];
  assert.equal(alice.name, 'Alice Marie Jones');
  assert.equal(alice.maidenName, 'Smith');
  assert.equal(alice.birthDate, '1955-03-12');
  assert.equal(alice.birthPlace, 'Atlanta, Georgia');
  assert.equal(alice.bio, 'Loved gardening.\nKept every letter.');
  assert.deepEqual(alice.lifeEvents, [
    { type: 'residence', date: '1975-01-01', place: 'Savannah', description: undefined },
    { type: 'military', date: undefined, place: undefined, description: 'Army nurse' },
  ]);
  assert.deepEqual(parsed.people[3].siblings, [{ xref: '@I5@', type: 'half' }]);
  assert.equal(parsed.people[4].deathDate, '2020-11-30');

  assert.equal(parsed.families.length, 2);
  const [first, second] = parsed.families;
  assert.deepEqual([...first.spouses].sort(), ['@I1@', '@I2@']);
  assert.deepEqual(first.children, ['@I4@']);
  assert.equal(first.status, 'divorced');
  assert.equal(first.marriageDate, '1980-06-15');
  assert.equal(first.divorceDate, '1995-02-01');
  assert.deepEqual([...second.spouses].sort(), ['@I1@', '@I3@']);
  assert.deepEqual(second.children, ['@I5@']);
  assert.equal(second.status, 'married');
  assert.equal(second.divorceDate, undefined);
});

test('parses foreign files: slashed surnames, partial dates, plain MARR', () => {
  const parsed = parseGedcom(
    [
      '0 HEAD',
      '0 @I1@ INDI',
      '1 NAME John /Smith/',
      '1 BIRT',
      '2 DATE ABT MAR 1950',
      '0 @I2@ INDI',
      '1 NAME Mary /Smith/',
      '1 BIRT',
      '2 DATE 1952',
      '0 @F1@ FAM',
      '1 HUSB @I1@',
      '1 WIFE @I2@',
      '1 MARR',
      '1 CHIL @I1@',
      '0 TRLR',
    ].join('\n'),
  );
  assert.equal(parsed.name, 'Imported family tree');
  assert.equal(parsed.people[0].name, 'John Smith');
  assert.equal(parsed.people[0].birthDate, '1950-03-01');
  assert.equal(parsed.people[1].birthDate, '1952-01-01');
  assert.equal(parsed.families[0].status, 'married');
  assert.equal(parsed.families[0].marriageDate, undefined);
});

test('a family without MARR or _STAT stays a parent-only family', () => {
  const parsed = parseGedcom(
    [
      '0 HEAD',
      '0 @I1@ INDI',
      '1 NAME A',
      '0 @I2@ INDI',
      '1 NAME B',
      '0 @F1@ FAM',
      '1 HUSB @I1@',
      '1 WIFE @I2@',
      '1 CHIL @I1@',
      '0 TRLR',
    ].join('\n'),
  );
  assert.equal(parsed.families[0].status, undefined);
});

test('rejects files that are not GEDCOM', () => {
  assert.throws(() => parseGedcom('hello world'), /valid GEDCOM/);
  assert.throws(() => parseGedcom('0 HEAD\n0 TRLR'), /does not contain any people/);
});
