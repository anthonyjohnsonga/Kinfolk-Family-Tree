import type { FastifyInstance } from 'fastify';
import { db } from './db.js';
import { normalizeToken, tokenToDate } from './partialDate.js';
import { loadTree } from './queries.js';
import type { PersonBody } from './contract.js';
import { peopleSearchQuerySchema, personBodySchema } from './schemas.js';
import { syncLifeEvents, syncRelationships } from './relationships.js';
import { searchPeople } from './search.js';

export function registerPeopleRoutes(app: FastifyInstance) {
  // Searches people in every tree, not just one, so the editor can attach a
  // relative who lives elsewhere. Declared before /api/people/:id-shaped routes
  // for readability; Fastify matches the static path regardless.
  app.get<{ Querystring: { q?: string; limit?: number } }>(
    '/api/people',
    { schema: { querystring: peopleSearchQuerySchema } },
    async (request) => searchPeople(request.query.q ?? '', request.query.limit),
  );
  app.post<{ Params: { treeId: string }; Body: PersonBody }>(
    '/api/trees/:treeId/people',
    { schema: { body: personBodySchema } },
    async (request, reply) => {
      const tree = await db.familyTree.findUnique({
        where: { id: request.params.treeId },
        select: { id: true },
      });
      if (!tree) return reply.code(404).send({ message: 'Tree not found' });
      const person = await db.person.create({
        data: {
          treeId: tree.id,
          name: request.body.name.trim(),
          maidenName: request.body.maidenName?.trim() || null,
          birthDate: tokenToDate(request.body.birthDate),
          birthDateToken: normalizeToken(request.body.birthDate),
          birthPlace: request.body.birthPlace?.trim() || null,
          deathDate: tokenToDate(request.body.deathDate),
          deathDateToken: normalizeToken(request.body.deathDate),
          deathPlace: request.body.deathPlace?.trim() || null,
          bio: request.body.bio?.trim(),
        },
      });
      await syncRelationships(person.id, tree.id, request.body);
      await syncLifeEvents(person.id, request.body);
      await db.familyTree.update({ where: { id: tree.id }, data: { updatedAt: new Date() } });
      return reply.code(201).send(await loadTree(tree.id));
    },
  );
  app.patch<{ Params: { id: string }; Body: PersonBody }>(
    '/api/people/:id',
    { schema: { body: personBodySchema } },
    async (request, reply) => {
      const existing = await db.person.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.code(404).send({ message: 'Person not found' });
      await db.person.update({
        where: { id: existing.id },
        data: {
          name: request.body.name.trim(),
          maidenName: request.body.maidenName?.trim() || null,
          birthDate: tokenToDate(request.body.birthDate),
          birthDateToken: normalizeToken(request.body.birthDate),
          birthPlace: request.body.birthPlace?.trim() || null,
          deathDate: tokenToDate(request.body.deathDate),
          deathDateToken: normalizeToken(request.body.deathDate),
          deathPlace: request.body.deathPlace?.trim() || null,
          bio: request.body.bio?.trim(),
        },
      });
      await syncRelationships(existing.id, existing.treeId, request.body);
      await syncLifeEvents(existing.id, request.body);
      await db.familyTree.update({
        where: { id: existing.treeId },
        data: { updatedAt: new Date() },
      });
      return loadTree(existing.treeId);
    },
  );
  app.delete<{ Params: { id: string } }>('/api/people/:id', async (request, reply) => {
    const existing = await db.person.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.code(404).send({ message: 'Person not found' });
    await db.person.delete({ where: { id: existing.id } });
    await db.familyTree.update({ where: { id: existing.treeId }, data: { updatedAt: new Date() } });
    return reply.code(204).send();
  });
}
