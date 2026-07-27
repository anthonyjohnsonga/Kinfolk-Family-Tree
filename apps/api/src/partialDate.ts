import { DATE_TOKEN_PATTERN } from './contract.js';

// Server-side handling of partial-date tokens (see contract.ts for the grammar).
// The API stores two values per date: the canonical token, and the resolved
// earliest instant used for chronological sorting.

const TOKEN = new RegExp(DATE_TOKEN_PATTERN);
const PARTS = /^[~<>]?(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/;

// Trim and accept a token only if it matches the grammar; anything else (an
// empty string, a stray value) becomes null so the columns clear together.
export function normalizeToken(value?: string | null): string | null {
  const token = value?.trim();
  return token && TOKEN.test(token) ? token : null;
}

// The earliest instant a token could mean: missing month/day resolve to
// January and the 1st, matching how a year-only date sorts before a full one.
export function tokenToDate(value?: string | null): Date | null {
  const token = normalizeToken(value);
  const match = token && PARTS.exec(token);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), (month ? Number(month) : 1) - 1, day ? Number(day) : 1));
}
