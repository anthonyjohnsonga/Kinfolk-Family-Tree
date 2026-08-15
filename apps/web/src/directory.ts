import type { ForeignPerson, Person, PersonSearchResult, Tree } from './types';

// What the relative pickers pass around. It is the search endpoint's wire shape
// (GET /api/people), so a hit from another tree and a person from the loaded
// tree are the same kind of thing everywhere in the editor.
export type PickedPerson = PersonSearchResult;

export function toPicked(person: Person, treeId: string, treeName: string): PickedPerson {
  return {
    id: person.id,
    name: person.name,
    maidenName: person.maidenName,
    treeId,
    treeName,
    birthDateToken: person.birthDateToken,
    deathDateToken: person.deathDateToken,
  };
}

// A stub for somebody in another tree carries no maiden name; their own tree
// holds the rest.
export const fromForeign = (person: ForeignPerson): PickedPerson => ({
  ...person,
  maidenName: null,
});

// Everyone the editor can name without asking the server: the loaded tree, plus
// the stubs for people it already links to elsewhere — so an existing
// cross-tree parent reads as their name rather than "Unknown person".
export function buildDirectory(tree: Tree): Map<string, PickedPerson> {
  const local = tree.people.map((person) => toPicked(person, tree.id, tree.name));
  const foreign = (tree.foreignPeople ?? []).map(fromForeign);
  return new Map([...local, ...foreign].map((person) => [person.id, person]));
}

// The loaded tree's matches first — no round trip, and the usual case — then
// anyone else the server found. Ids already spoken for (the person being
// edited, relatives already added, the other parent) never appear, and a
// server hit that is really a local person is dropped rather than listed twice.
export function mergeCandidates(
  local: PickedPerson[],
  remote: PickedPerson[],
  exclude: Iterable<string> = [],
): PickedPerson[] {
  const taken = new Set(exclude);
  const results = local.filter((person) => !taken.has(person.id));
  results.forEach((person) => taken.add(person.id));
  return [...results, ...remote.filter((person) => !taken.has(person.id))];
}
