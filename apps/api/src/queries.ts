import { db } from './db.js';

// A tree's own people carry the edges that start on them. Cross-tree links are
// the exception: when this tree's person is the PARENT and the child lives
// elsewhere, only the child's record would carry it, so childLinks is included
// filtered to outside children. Same-tree children are left out on purpose —
// they are already covered by that child's own parentLinks, and including them
// would duplicate every edge in an ordinary single-tree payload.
export const treeInclude = (treeId: string) => ({
  people: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      parentLinks: true,
      childLinks: { where: { child: { treeId: { not: treeId } } } },
      partnershipsA: true,
      partnershipsB: true,
      siblingLinksA: true,
      siblingLinksB: true,
      lifeEvents: { orderBy: { date: 'asc' as const } },
      // Photo bytes are excluded on purpose: the tree fetch stays light and the
      // image data is streamed separately from GET /api/photos/:id.
      photos: {
        orderBy: [{ isPrimary: 'desc' as const }, { order: 'asc' as const }],
        select: {
          id: true,
          contentType: true,
          caption: true,
          isPrimary: true,
          order: true,
          createdAt: true,
        },
      },
    },
  },
});

// Like treeInclude but carries the photo bytes, for GEDCOM export where the
// image data is embedded in the .ged file rather than fetched separately.
// Cross-tree edges are deliberately absent: a .ged file describes one tree, so
// export keeps only the relationships whose endpoints are both inside it.
export const gedcomInclude = {
  people: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      parentLinks: true,
      partnershipsA: true,
      partnershipsB: true,
      siblingLinksA: true,
      siblingLinksB: true,
      lifeEvents: { orderBy: { date: 'asc' as const } },
      photos: {
        orderBy: [{ isPrimary: 'desc' as const }, { order: 'asc' as const }],
        select: { data: true, contentType: true, caption: true, isPrimary: true },
      },
    },
  },
};

const findTree = (treeId: string, client: typeof db) =>
  client.familyTree.findUnique({ where: { id: treeId }, include: treeInclude(treeId) });
type LoadedTree = NonNullable<Awaited<ReturnType<typeof findTree>>>;

// Every person id an edge points at, so the loader can tell which ones live
// outside this tree.
function referencedIds(tree: LoadedTree) {
  const ids = new Set<string>();
  tree.people.forEach((person) => {
    person.parentLinks.forEach((link) => ids.add(link.parentId));
    person.childLinks.forEach((link) => ids.add(link.childId));
    [...person.partnershipsA, ...person.partnershipsB].forEach((link) => {
      ids.add(link.partnerAId);
      ids.add(link.partnerBId);
    });
    [...person.siblingLinksA, ...person.siblingLinksB].forEach((link) => {
      ids.add(link.siblingAId);
      ids.add(link.siblingBId);
    });
  });
  return ids;
}

// Loads one tree along with a stub for every person it links to in another
// tree, so the client can draw the far end of a cross-tree edge without
// fetching that whole tree. Returns null when the tree does not exist.
export async function loadTree(treeId: string, client: typeof db = db) {
  const tree = await findTree(treeId, client);
  if (!tree) return null;
  const local = new Set(tree.people.map((person) => person.id));
  const outside = [...referencedIds(tree)].filter((id) => !local.has(id));
  if (!outside.length) return { ...tree, foreignPeople: [] };
  const people = await client.person.findMany({
    where: { id: { in: outside } },
    select: {
      id: true,
      name: true,
      treeId: true,
      birthDateToken: true,
      deathDateToken: true,
      tree: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  });
  return {
    ...tree,
    foreignPeople: people.map(({ tree: owner, ...person }) => ({
      ...person,
      treeName: owner.name,
    })),
  };
}
