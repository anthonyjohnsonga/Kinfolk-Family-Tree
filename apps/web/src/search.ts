import type { Person } from './types';

// Case-insensitive people search: every whitespace-separated term must appear
// somewhere in the person's name, maiden name, or recorded places. An empty
// query matches everyone. Results are sorted by name.
export function searchPeople(people: Person[], query: string): Person[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = people.filter((person) => {
    if (!terms.length) return true;
    const haystack = [person.name, person.maidenName, person.birthPlace, person.deathPlace]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
  return [...matches].sort((a, b) => a.name.localeCompare(b.name));
}
