import type { Person } from './types';

export type Point = { x: number; y: number };
export type Family = { parentIds: string[]; children: Person[] };

// Assigns each person to a generation row, returned as [generation, people]
// pairs sorted top row first. A person's depth is max(parent depth) + 1 with a
// cycle guard; union-find then merges everyone connected by partnership or
// sibling links so that, e.g., a spouse with no recorded parents still renders
// on their partner's row. Each connected group sits at its deepest member's
// generation.
export function computeGenerations(people: Person[]): [number, Person[]][] {
  const cache = new Map<string, number>();
  const base = (p: Person, trail = new Set<string>()): number => {
    if (cache.has(p.id)) return cache.get(p.id)!;
    if (trail.has(p.id) || !p.parentLinks.length) return 0;
    const next = new Set(trail).add(p.id);
    const parents = p.parentLinks
      .map((l) => people.find((x) => x.id === l.parentId))
      .filter(Boolean) as Person[];
    const value = parents.length ? Math.max(...parents.map((x) => base(x, next))) + 1 : 0;
    cache.set(p.id, value);
    return value;
  };
  const roots = new Map(people.map((p) => [p.id, p.id]));
  const find = (id: string): string => {
    const parent = roots.get(id) || id;
    if (parent === id) return id;
    const root = find(parent);
    roots.set(id, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const left = find(a);
    const right = find(b);
    if (left !== right) roots.set(right, left);
  };
  people.forEach((p) => {
    p.partnershipsA.forEach((x) => union(x.partnerAId, x.partnerBId));
    p.partnershipsB.forEach((x) => union(x.partnerAId, x.partnerBId));
    p.siblingLinksA.forEach((x) => union(x.siblingAId, x.siblingBId));
    p.siblingLinksB.forEach((x) => union(x.siblingAId, x.siblingBId));
  });
  const groupGeneration = new Map<string, number>();
  people.forEach((p) => {
    const root = find(p.id);
    groupGeneration.set(root, Math.max(groupGeneration.get(root) || 0, base(p)));
  });
  const map = new Map<number, Person[]>();
  people.forEach((p) => {
    const n = groupGeneration.get(find(p.id)) || 0;
    map.set(n, [...(map.get(n) || []), p]);
  });
  return [...map.entries()].sort(([a], [b]) => a - b);
}

// Groups children by their exact (deduplicated, sorted) set of parent ids so
// each family draws one shared connector.
export function groupFamilies(people: Person[]): Family[] {
  const families = new Map<string, Family>();
  people.forEach((child) => {
    const parentIds = [...new Set(child.parentLinks.map((link) => link.parentId))].sort();
    if (!parentIds.length) return;
    const key = parentIds.join('|');
    const family = families.get(key);
    if (family) family.children.push(child);
    else families.set(key, { parentIds, children: [child] });
  });
  return [...families.values()];
}

// Builds the SVG path for one family's connector. All coordinates are relative
// to the tree container: parent points are card bottom-centers, child points
// are card top-centers, and coupleAnchor is the center of the couple
// connector line when both parents render as a couple. Parents drop to a join
// point, a horizontal bus spans the children, and verticals drop to each
// child.
export function buildConnectorPath(
  parentPoints: Point[],
  childPoints: Point[],
  coupleAnchor: Point | null,
): string {
  const parentBottom = Math.max(...parentPoints.map((point) => point.y));
  const childTop = Math.min(...childPoints.map((point) => point.y));
  const gap = Math.max(24, childTop - parentBottom);
  const parentJoinY = parentBottom + gap * 0.35;
  const childBusY = parentBottom + gap * 0.65;
  const segments: string[] = [];
  let joinX = parentPoints.reduce((sum, point) => sum + point.x, 0) / parentPoints.length;
  if (coupleAnchor) {
    joinX = coupleAnchor.x;
    segments.push(`M ${joinX} ${coupleAnchor.y} V ${childBusY}`);
  } else if (parentPoints.length === 1) {
    segments.push(`M ${parentPoints[0].x} ${parentPoints[0].y} V ${childBusY}`);
  } else {
    parentPoints.forEach((point) =>
      segments.push(`M ${point.x} ${point.y} V ${parentJoinY} H ${joinX}`),
    );
    segments.push(`M ${joinX} ${parentJoinY} V ${childBusY}`);
  }
  const busPoints = [joinX, ...childPoints.map((point) => point.x)];
  segments.push(`M ${Math.min(...busPoints)} ${childBusY} H ${Math.max(...busPoints)}`);
  childPoints.forEach((point) => segments.push(`M ${point.x} ${childBusY} V ${point.y}`));
  return segments.join(' ');
}
