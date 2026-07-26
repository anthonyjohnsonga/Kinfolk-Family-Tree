export const treeInclude = {
  people: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      parentLinks: true,
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
};
