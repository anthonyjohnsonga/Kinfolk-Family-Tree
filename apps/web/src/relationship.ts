import type { Person } from './types';

// Describes how two people are related, as a plain sentence. Direct
// partnerships win (spouses stay "spouses" even when they are also cousins),
// then blood relationships through the nearest common ancestor, then explicit
// sibling links (step and adopted siblings share no ancestor). Terms are
// gender-neutral because Kinfolk does not record gender.

const ORDINALS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
];
const ordinal = (value: number) => ORDINALS[value - 1] || `${value}th`;
const greats = (count: number) => 'great-'.repeat(count);
const removedText = (count: number) =>
  count === 0
    ? ''
    : count === 1
      ? ' once removed'
      : count === 2
        ? ' twice removed'
        : ` ${count} times removed`;

// Minimum number of parent steps from the starting person to every reachable
// blood ancestor, the starting person included at distance 0.
function ancestorDistances(people: Person[], startId: string): Map<string, number> {
  const byId = new Map(people.map((person) => [person.id, person]));
  const distances = new Map([[startId, 0]]);
  const queue = [startId];
  while (queue.length) {
    const id = queue.shift()!;
    const distance = distances.get(id)!;
    byId.get(id)?.parentLinks.forEach((link) => {
      if (byId.has(link.parentId) && !distances.has(link.parentId)) {
        distances.set(link.parentId, distance + 1);
        queue.push(link.parentId);
      }
    });
  }
  return distances;
}

const SIBLING_LABELS: Record<string, string> = {
  sibling: 'siblings',
  full: 'siblings',
  half: 'half-siblings',
  step: 'step-siblings',
  adopted: 'adopted siblings',
};

export function describeRelationship(people: Person[], aId: string, bId: string): string {
  const a = people.find((person) => person.id === aId);
  const b = people.find((person) => person.id === bId);
  if (!a || !b) return 'Select two people.';
  if (a.id === b.id) return 'Select two different people.';

  const partnership = [...a.partnershipsA, ...a.partnershipsB].find(
    (link) => (link.partnerAId === a.id ? link.partnerBId : link.partnerAId) === b.id,
  );
  if (partnership) {
    if (partnership.status === 'divorced') return `${a.name} and ${b.name} are former spouses.`;
    if (partnership.status === 'partnered') return `${a.name} and ${b.name} are partners.`;
    return `${a.name} and ${b.name} are spouses.`;
  }

  const fromA = ancestorDistances(people, a.id);
  const fromB = ancestorDistances(people, b.id);
  let best: { up: number; down: number; ancestors: string[] } | null = null;
  for (const [id, up] of fromA) {
    const down = fromB.get(id);
    if (down === undefined) continue;
    if (
      !best ||
      up + down < best.up + best.down ||
      (up + down === best.up + best.down && Math.abs(up - down) < Math.abs(best.up - best.down))
    )
      best = { up, down, ancestors: [id] };
    else if (up === best.up && down === best.down) best.ancestors.push(id);
  }
  if (best) {
    const { up, down } = best;
    if (up === 0)
      return `${b.name} is ${a.name}'s ${down === 1 ? 'child' : `${greats(down - 2)}grandchild`}.`;
    if (down === 0)
      return `${b.name} is ${a.name}'s ${up === 1 ? 'parent' : `${greats(up - 2)}grandparent`}.`;
    const names = best.ancestors
      .map((id) => people.find((person) => person.id === id)?.name)
      .filter(Boolean)
      .slice(0, 2)
      .join(' and ');
    const through = names ? ` (through ${names})` : '';
    if (up === 1 && down === 1)
      return `${a.name} and ${b.name} are ${best.ancestors.length > 1 ? 'siblings' : 'half-siblings'}${through}.`;
    if (up === 1) return `${b.name} is ${a.name}'s ${greats(down - 2)}niece or nephew${through}.`;
    if (down === 1) return `${b.name} is ${a.name}'s ${greats(up - 2)}aunt or uncle${through}.`;
    const degree = Math.min(up, down) - 1;
    const removed = Math.abs(up - down);
    return `${a.name} and ${b.name} are ${ordinal(degree)} cousins${removedText(removed)}${through}.`;
  }

  const siblingLink = [...a.siblingLinksA, ...a.siblingLinksB].find(
    (link) => (link.siblingAId === a.id ? link.siblingBId : link.siblingAId) === b.id,
  );
  if (siblingLink)
    return `${a.name} and ${b.name} are ${SIBLING_LABELS[siblingLink.type] || 'siblings'}.`;

  return `No relationship is recorded between ${a.name} and ${b.name}.`;
}
