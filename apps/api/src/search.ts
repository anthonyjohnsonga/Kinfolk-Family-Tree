import { db } from './db.js';
import { MAX_PEOPLE_SEARCH_RESULTS, type PersonSearchResult } from './contract.js';

// Every tree is visible to any signed-in account, so this search deliberately
// spans all of them: it is what lets the editor attach a relative who lives in
// another tree. The caller gets each hit's tree so it can label the far side.

// Whitespace splits the query into terms that must ALL match, so "ada glasgow"
// finds an Ada born in Glasgow. The cap keeps a pathological query from turning
// into an unbounded pile of SQL conditions.
const MAX_TERMS = 8;

export function searchTerms(query: string): string[] {
  return query.trim().split(/\s+/).filter(Boolean).slice(0, MAX_TERMS);
}

// The fields a person is recognised by — the same ones the in-tree quick search
// looks at (apps/web/src/search.ts), so both searches feel alike.
const matchesTerm = (term: string) => ({
  OR: [
    { name: { contains: term, mode: 'insensitive' as const } },
    { maidenName: { contains: term, mode: 'insensitive' as const } },
    { birthPlace: { contains: term, mode: 'insensitive' as const } },
    { deathPlace: { contains: term, mode: 'insensitive' as const } },
  ],
});

export const personSearchWhere = (terms: string[]) => ({ AND: terms.map(matchesTerm) });

export async function searchPeople(
  query: string,
  limit: number = MAX_PEOPLE_SEARCH_RESULTS,
  client: typeof db = db,
): Promise<PersonSearchResult[]> {
  const terms = searchTerms(query);
  // An empty query has nothing to narrow by. Returning the first N people of
  // every tree would be a meaningless list, so say nothing instead and let the
  // caller keep showing whatever it shows before you type.
  if (!terms.length) return [];
  const people = await client.person.findMany({
    where: personSearchWhere(terms),
    select: {
      id: true,
      name: true,
      maidenName: true,
      treeId: true,
      birthDateToken: true,
      deathDateToken: true,
      tree: { select: { name: true } },
    },
    orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    take: Math.min(Math.max(Math.trunc(limit) || 1, 1), MAX_PEOPLE_SEARCH_RESULTS),
  });
  return people.map(({ tree, ...person }) => ({ ...person, treeName: tree.name }));
}
