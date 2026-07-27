import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildToken, formatToken, formatTokenShort, parseToken } from './partialDate';

test('parses tokens of each precision and qualifier', () => {
  assert.deepEqual(parseToken('1880'), { qualifier: 'exact', year: '1880', month: '', day: '' });
  assert.deepEqual(parseToken('~1880'), { qualifier: 'about', year: '1880', month: '', day: '' });
  assert.deepEqual(parseToken('1950-03'), {
    qualifier: 'exact',
    year: '1950',
    month: '03',
    day: '',
  });
  assert.deepEqual(parseToken('>1900-06-15'), {
    qualifier: 'after',
    year: '1900',
    month: '06',
    day: '15',
  });
  assert.deepEqual(parseToken(null), { qualifier: 'exact', year: '', month: '', day: '' });
});

test('builds tokens and drops parts that cannot stand alone', () => {
  assert.equal(
    buildToken({ qualifier: 'exact', year: '1950', month: '03', day: '12' }),
    '1950-03-12',
  );
  assert.equal(buildToken({ qualifier: 'about', year: '1880', month: '', day: '' }), '~1880');
  assert.equal(buildToken({ qualifier: 'before', year: '1945', month: '', day: '' }), '<1945');
  // A day without a month cannot be placed, so it is dropped.
  assert.equal(buildToken({ qualifier: 'exact', year: '1950', month: '', day: '12' }), '1950');
  // An incomplete year yields no token at all.
  assert.equal(buildToken({ qualifier: 'exact', year: '19', month: '05', day: '' }), '');
});

test('formats tokens as readable text', () => {
  assert.equal(formatToken('1950-03-12'), '12 March 1950');
  assert.equal(formatToken('1950-03'), 'March 1950');
  assert.equal(formatToken('~1880'), 'about 1880');
  assert.equal(formatToken('<1945'), 'before 1945');
  assert.equal(formatToken(null), '');
});

test('formats a compact year form for tree cards', () => {
  assert.equal(formatTokenShort('1950-03-12'), '1950');
  assert.equal(formatTokenShort('~1880'), 'c. 1880');
  assert.equal(formatTokenShort('>1900'), 'a. 1900');
  assert.equal(formatTokenShort(null), '?');
});

test('a full-precision token round trips through parse and build', () => {
  const token = '1955-12-31';
  assert.equal(buildToken(parseToken(token)), token);
});
