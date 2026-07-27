import type { DateQualifier } from './types';

// Client-side handling of partial-date tokens (see the API contract for the
// grammar). The structured date controls edit these parts; display formats a
// token into readable text.

export type DateParts = { qualifier: DateQualifier; year: string; month: string; day: string };

const QUALIFIER_PREFIX: Record<DateQualifier, string> = {
  exact: '',
  about: '~',
  before: '<',
  after: '>',
};
const PREFIX_QUALIFIER: Record<string, DateQualifier> = {
  '~': 'about',
  '<': 'before',
  '>': 'after',
};
const QUALIFIER_WORD: Record<DateQualifier, string> = {
  exact: '',
  about: 'about ',
  before: 'before ',
  after: 'after ',
};
const QUALIFIER_ABBR: Record<DateQualifier, string> = {
  exact: '',
  about: 'c. ',
  before: 'b. ',
  after: 'a. ',
};
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const EMPTY: DateParts = { qualifier: 'exact', year: '', month: '', day: '' };

export function parseToken(token: string | null | undefined): DateParts {
  if (!token) return { ...EMPTY };
  const qualifier = PREFIX_QUALIFIER[token[0]] || 'exact';
  const rest = qualifier === 'exact' ? token : token.slice(1);
  const [year = '', month = '', day = ''] = rest.split('-');
  return { qualifier, year, month, day };
}

// Assemble a token from edited parts; an incomplete year yields no token, and a
// day without a month is dropped since it cannot be placed.
export function buildToken(parts: DateParts): string {
  if (!/^\d{4}$/.test(parts.year)) return '';
  let value = parts.year;
  if (parts.month) {
    value += `-${parts.month.padStart(2, '0')}`;
    if (parts.day) value += `-${parts.day.padStart(2, '0')}`;
  }
  return QUALIFIER_PREFIX[parts.qualifier] + value;
}

// Full readable form, e.g. "12 March 1950", "March 1950", "about 1880".
export function formatToken(token: string | null | undefined): string {
  const { qualifier, year, month, day } = parseToken(token);
  if (!year) return '';
  const monthName = month ? MONTHS[Number(month) - 1] : '';
  const body =
    day && monthName
      ? `${Number(day)} ${monthName} ${year}`
      : monthName
        ? `${monthName} ${year}`
        : year;
  return QUALIFIER_WORD[qualifier] + body;
}

// Compact year-only form for tree cards, e.g. "c. 1880", "1950", or "?".
export function formatTokenShort(token: string | null | undefined): string {
  const { qualifier, year } = parseToken(token);
  return year ? QUALIFIER_ABBR[qualifier] + year : '?';
}
