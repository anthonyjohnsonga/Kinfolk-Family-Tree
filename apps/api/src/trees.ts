import type { FastifyInstance } from 'fastify';
import { db } from './db.js';
import { date, ordered } from './utils.js';
import { treeInclude } from './queries.js';
import { buildGedcom, parseGedcom } from './gedcom.js';

export function registerTreeRoutes(app: FastifyInstance) {
  app.get('/api/trees', async () =>
    db.familyTree.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { people: true } },
      },
    }),
  );
  app.post<{ Body: { name: string; firstPerson?: { name: string; birthDate?: string } } }>(
    '/api/trees',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 80 },
            firstPerson: {
              type: 'object',
              additionalProperties: false,
              required: ['name'],
              properties: {
                name: { type: 'string', minLength: 1, maxLength: 80 },
                birthDate: { type: 'string', format: 'date' },
              },
            },
          },
        },
      },
    },
    async (request, reply) =>
      reply.code(201).send(
        await db.familyTree.create({
          data: {
            name: request.body.name.trim(),
            people: request.body.firstPerson
              ? {
                  create: {
                    name: request.body.firstPerson.name.trim(),
                    birthDate: date(request.body.firstPerson.birthDate),
                  },
                }
              : undefined,
          },
          include: treeInclude,
        }),
      ),
  );
  app.get<{ Params: { id: string } }>('/api/trees/:id', async (request, reply) => {
    const tree = await db.familyTree.findUnique({
      where: { id: request.params.id },
      include: treeInclude,
    });
    return tree || reply.code(404).send({ message: 'Tree not found' });
  });
  app.get<{ Params: { id: string } }>('/api/trees/:id/gedcom', async (request, reply) => {
    const tree = await db.familyTree.findUnique({
      where: { id: request.params.id },
      include: treeInclude,
    });
    if (!tree) return reply.code(404).send({ message: 'Tree not found' });
    const stem = tree.name
      .trim()
      .replace(/[^A-Za-z0-9-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return {
      filename: `${stem || 'family-tree'}.ged`,
      gedcom: buildGedcom(tree.name, tree.people),
    };
  });
  app.post<{ Body: { gedcom: string } }>(
    '/api/trees/import',
    {
      bodyLimit: 10_000_000,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['gedcom'],
          properties: { gedcom: { type: 'string', minLength: 1 } },
        },
      },
    },
    async (request, reply) => {
      const parsed = parseGedcom(request.body.gedcom);
      const treeId = await db.$transaction(
        async (tx) => {
          const tree = await tx.familyTree.create({ data: { name: parsed.name.slice(0, 80) } });
          const idByXref = new Map<string, string>();
          for (const person of parsed.people) {
            const created = await tx.person.create({
              data: {
                treeId: tree.id,
                name: person.name.slice(0, 80),
                maidenName: person.maidenName?.slice(0, 80) || null,
                birthDate: date(person.birthDate),
                birthPlace: person.birthPlace?.slice(0, 160) || null,
                deathDate: date(person.deathDate),
                deathPlace: person.deathPlace?.slice(0, 160) || null,
                bio: person.bio?.slice(0, 2000) || null,
              },
            });
            idByXref.set(person.xref, created.id);
          }
          for (const person of parsed.people) {
            const personId = idByXref.get(person.xref)!;
            if (person.lifeEvents.length)
              await tx.lifeEvent.createMany({
                data: person.lifeEvents.map((event) => ({
                  personId,
                  type: event.type,
                  date: date(event.date),
                  place: event.place?.slice(0, 160) || null,
                  description: event.description?.slice(0, 1000) || null,
                })),
              });
            for (const sibling of person.siblings) {
              const otherId = idByXref.get(sibling.xref);
              if (!otherId || otherId === personId) continue;
              const [siblingAId, siblingBId] = ordered(personId, otherId);
              await tx.siblingRelationship.upsert({
                where: { siblingAId_siblingBId: { siblingAId, siblingBId } },
                create: { treeId: tree.id, siblingAId, siblingBId, type: sibling.type },
                update: {},
              });
            }
          }
          for (const family of parsed.families) {
            const spouses = family.spouses
              .map((xref) => idByXref.get(xref))
              .filter(Boolean) as string[];
            const children = family.children
              .map((xref) => idByXref.get(xref))
              .filter(Boolean) as string[];
            for (const childId of children)
              for (const parentId of spouses)
                if (parentId !== childId)
                  await tx.parentRelationship.upsert({
                    where: { parentId_childId: { parentId, childId } },
                    create: { treeId: tree.id, parentId, childId },
                    update: {},
                  });
            if (family.status && spouses.length === 2 && spouses[0] !== spouses[1]) {
              const [partnerAId, partnerBId] = ordered(spouses[0], spouses[1]);
              await tx.partnership.upsert({
                where: { partnerAId_partnerBId: { partnerAId, partnerBId } },
                create: {
                  treeId: tree.id,
                  partnerAId,
                  partnerBId,
                  status: family.status,
                  marriageDate: date(family.marriageDate),
                  divorceDate: date(family.divorceDate),
                },
                update: {},
              });
            }
          }
          return tree.id;
        },
        { timeout: 60_000 },
      );
      return reply
        .code(201)
        .send(await db.familyTree.findUnique({ where: { id: treeId }, include: treeInclude }));
    },
  );
  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      backgroundStyle?: string;
      backgroundColor?: string;
      treeColor?: string;
      accentColor?: string;
    };
  }>(
    '/api/trees/:id',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 80 },
            backgroundStyle: { enum: ['botanical', 'classic', 'minimal'] },
            backgroundColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
            treeColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
            accentColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        return await db.familyTree.update({
          where: { id: request.params.id },
          data: request.body,
          include: treeInclude,
        });
      } catch {
        return reply.code(404).send({ message: 'Tree not found' });
      }
    },
  );
}
