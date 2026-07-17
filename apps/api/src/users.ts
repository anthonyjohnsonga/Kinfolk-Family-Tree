import type { FastifyInstance } from 'fastify';
import { db } from './db.js';
import { hashPassword } from './auth.js';
import { userRoles, type UserRole } from './contract.js';

const userSelect = { id: true, username: true, role: true, createdAt: true };

// All /api/users routes are restricted to administrators by the preHandler
// guard in server.ts. Two invariants are enforced here: at least one
// administrator always remains, and nobody can delete their own account.
export function registerUserRoutes(app: FastifyInstance) {
  app.get('/api/users', async () =>
    db.user.findMany({ orderBy: { username: 'asc' }, select: userSelect }),
  );
  app.post<{ Body: { username: string; password: string; role: UserRole } }>(
    '/api/users',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['username', 'password', 'role'],
          properties: {
            username: { type: 'string', minLength: 3, maxLength: 40, pattern: '^[A-Za-z0-9._-]+$' },
            password: { type: 'string', minLength: 12, maxLength: 128 },
            role: { type: 'string', enum: userRoles },
          },
        },
      },
    },
    async (request, reply) => {
      const username = request.body.username.toLowerCase();
      if (await db.user.findUnique({ where: { username } }))
        return reply.code(409).send({ message: 'That username is already taken' });
      const user = await db.user.create({
        data: {
          username,
          passwordHash: await hashPassword(request.body.password),
          role: request.body.role,
        },
        select: userSelect,
      });
      return reply.code(201).send(user);
    },
  );
  app.patch<{ Params: { id: string }; Body: { role?: UserRole; password?: string } }>(
    '/api/users/:id',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            role: { type: 'string', enum: userRoles },
            password: { type: 'string', minLength: 12, maxLength: 128 },
          },
        },
      },
    },
    async (request, reply) => {
      const target = await db.user.findUnique({ where: { id: request.params.id } });
      if (!target) return reply.code(404).send({ message: 'User not found' });
      const { role, password } = request.body;
      if (role && role !== 'admin' && target.role === 'admin') {
        const admins = await db.user.count({ where: { role: 'admin' } });
        if (admins <= 1)
          return reply.code(409).send({ message: 'Kinfolk needs at least one administrator' });
      }
      const user = await db.user.update({
        where: { id: target.id },
        data: {
          role: role ?? undefined,
          passwordHash: password ? await hashPassword(password) : undefined,
        },
        select: userSelect,
      });
      // A changed password signs that user out everywhere.
      if (password) await db.session.deleteMany({ where: { userId: target.id } });
      return user;
    },
  );
  app.delete<{ Params: { id: string } }>('/api/users/:id', async (request, reply) => {
    if (request.user?.id === request.params.id)
      return reply.code(409).send({ message: 'You cannot delete your own account' });
    const target = await db.user.findUnique({ where: { id: request.params.id } });
    if (!target) return reply.code(404).send({ message: 'User not found' });
    if (target.role === 'admin') {
      const admins = await db.user.count({ where: { role: 'admin' } });
      if (admins <= 1)
        return reply.code(409).send({ message: 'Kinfolk needs at least one administrator' });
    }
    await db.user.delete({ where: { id: target.id } });
    return reply.code(204).send();
  });
}
