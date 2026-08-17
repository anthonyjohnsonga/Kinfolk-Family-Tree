import type { FastifyInstance } from 'fastify';
import { db } from './db.js';
import { MAX_SOURCE_RESULTS, type SourceInput, type SourceRecord } from './contract.js';
import { sourceBodySchema, sourceSearchQuerySchema, sourceUpdateSchema } from './schemas.js';

// The source library is shared by every tree — see the Source model in
// schema.prisma for why. That means these routes never take a tree id, and a
// source stays in the library after the tree that motivated it is deleted.

// Whitespace splits the query into terms that must ALL match, so
// "1880 census" finds the 1880 census rather than everything from 1880.
const MAX_TERMS = 8;

export function searchTerms(query: string): string[] {
  return query.trim().split(/\s+/).filter(Boolean).slice(0, MAX_TERMS);
}

// The fields a source is recognised by. Notes are searched too: that is where
// "the page was torn across the surname" ends up, and it is often the only
// thing you remember about a source later.
const matchesTerm = (term: string) => ({
  OR: [
    { title: { contains: term, mode: 'insensitive' as const } },
    { author: { contains: term, mode: 'insensitive' as const } },
    { publication: { contains: term, mode: 'insensitive' as const } },
    { repository: { contains: term, mode: 'insensitive' as const } },
    { notes: { contains: term, mode: 'insensitive' as const } },
  ],
});

export const sourceSearchWhere = (terms: string[]) => ({ AND: terms.map(matchesTerm) });

export async function listSources(
  query = '',
  limit: number = MAX_SOURCE_RESULTS,
  client: typeof db = db,
): Promise<SourceRecord[]> {
  const terms = searchTerms(query);
  const sources = await client.source.findMany({
    // A blank query lists the library. Unlike the people search there is no
    // harm in that: a source list is meant to be browsed, and it is bounded by
    // how much research has been recorded rather than by how many people exist.
    where: terms.length ? sourceSearchWhere(terms) : undefined,
    orderBy: [{ title: 'asc' }, { createdAt: 'asc' }],
    take: Math.min(Math.max(Math.trunc(limit) || 1, 1), MAX_SOURCE_RESULTS),
  });
  return sources.map((source) => ({
    ...source,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  }));
}

// Optional text fields are stored as null rather than "", so "absent" has one
// representation instead of two.
const trimmed = (value: string | undefined) => value?.trim() || null;

export function sourceData(body: SourceInput) {
  return {
    title: body.title.trim(),
    author: trimmed(body.author),
    publication: trimmed(body.publication),
    repository: trimmed(body.repository),
    notes: trimmed(body.notes),
  };
}

// A PATCH carries only the fields it means to change, so an absent key must
// stay absent rather than becoming null and wiping a value the caller never
// mentioned.
export function sourcePatch(body: Partial<SourceInput>) {
  const data: Record<string, string | null> = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.author !== undefined) data.author = trimmed(body.author);
  if (body.publication !== undefined) data.publication = trimmed(body.publication);
  if (body.repository !== undefined) data.repository = trimmed(body.repository);
  if (body.notes !== undefined) data.notes = trimmed(body.notes);
  return data;
}

export function registerSourceRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { q?: string; limit?: number } }>(
    '/api/sources',
    { schema: { querystring: sourceSearchQuerySchema } },
    async (request) => listSources(request.query.q ?? '', request.query.limit),
  );

  app.post<{ Body: SourceInput }>(
    '/api/sources',
    { schema: { body: sourceBodySchema } },
    async (request, reply) => {
      const created = await db.source.create({ data: sourceData(request.body) });
      return reply.code(201).send({
        ...created,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      });
    },
  );

  app.patch<{ Params: { id: string }; Body: Partial<SourceInput> }>(
    '/api/sources/:id',
    { schema: { body: sourceUpdateSchema } },
    async (request, reply) => {
      try {
        const updated = await db.source.update({
          where: { id: request.params.id },
          data: sourcePatch(request.body),
        });
        return {
          ...updated,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        };
      } catch {
        return reply.code(404).send({ message: 'Source not found' });
      }
    },
  );

  app.delete<{ Params: { id: string } }>('/api/sources/:id', async (request, reply) => {
    try {
      await db.source.delete({ where: { id: request.params.id } });
      return reply.code(204).send();
    } catch {
      return reply.code(404).send({ message: 'Source not found' });
    }
  });
}
