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

// How many recorded relationships have one end outside this tree. Each is
// counted once: only this side's copy of the edge was ever loaded, because the
// people it points at are stubs. Used to say plainly what a GEDCOM export of
// this tree will leave behind.
export function countCrossTreeLinks(tree: Tree): number {
  const local = new Set(tree.people.map((person) => person.id));
  const outside = (id: string) => !local.has(id);
  return tree.people.reduce((total, person) => {
    const other = (a: string, b: string) => (a === person.id ? b : a);
    return (
      total +
      person.parentLinks.filter((link) => outside(link.parentId)).length +
      person.childLinks.filter((link) => outside(link.childId)).length +
      [...person.partnershipsA, ...person.partnershipsB].filter((link) =>
        outside(other(link.partnerAId, link.partnerBId)),
      ).length +
      [...person.siblingLinksA, ...person.siblingLinksB].filter((link) =>
        outside(other(link.siblingAId, link.siblingBId)),
      ).length
    );
  }, 0);
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
