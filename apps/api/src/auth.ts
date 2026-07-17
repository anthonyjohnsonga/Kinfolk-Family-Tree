import { type FastifyInstance, type FastifyReply } from 'fastify';
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { db } from './db.js';

export type SessionUser = { id: string; username: string; role: string };
declare module 'fastify' {
  interface FastifyRequest {
    user?: SessionUser;
  }
}

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = 'kinfolk_session';
const SESSION_DAYS = Math.max(1, Number(process.env.SESSION_DAYS || 7));
const cookieOptions = {
  path: '/',
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.COOKIE_SECURE === 'true',
  maxAge: SESSION_DAYS * 86400,
};
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}
async function verifyPassword(password: string, encoded: string) {
  const [algorithm, saltValue, hashValue] = encoded.split('$');
  if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false;
  const expected = Buffer.from(hashValue, 'base64url');
  const actual = (await scrypt(
    password,
    Buffer.from(saltValue, 'base64url'),
    expected.length,
  )) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
async function createSession(userId: string, reply: FastifyReply) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.session.create({ data: { userId, tokenHash: tokenHash(token), expiresAt } });
  reply.setCookie(SESSION_COOKIE, token, cookieOptions);
}
export async function currentUser(request: { cookies: Record<string, string | undefined> }) {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: { select: { id: true, username: true, role: true } } },
  });
  if (!session || session.expiresAt <= new Date()) {
    if (session) await db.session.delete({ where: { id: session.id } });
    return null;
  }
  return session.user;
}

export function registerAuthRoutes(app: FastifyInstance) {
  app.get('/api/auth/status', async (request) => {
    const [count, user] = await Promise.all([db.user.count(), currentUser(request)]);
    return { setupRequired: count === 0, authenticated: Boolean(user), user };
  });
  app.post<{ Body: { username: string; password: string } }>(
    '/api/auth/setup',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', minLength: 3, maxLength: 40, pattern: '^[A-Za-z0-9._-]+$' },
            password: { type: 'string', minLength: 12, maxLength: 128 },
          },
        },
      },
    },
    async (request, reply) => {
      if (await db.user.count())
        return reply.code(409).send({ message: 'Administrator setup has already been completed' });
      const user = await db.user.create({
        data: {
          username: request.body.username.toLowerCase(),
          passwordHash: await hashPassword(request.body.password),
        },
        select: { id: true, username: true, role: true },
      });
      await createSession(user.id, reply);
      return reply.code(201).send({ user });
    },
  );
  app.post<{ Body: { username: string; password: string } }>(
    '/api/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', minLength: 1, maxLength: 40 },
            password: { type: 'string', minLength: 1, maxLength: 128 },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await db.user.findUnique({
        where: { username: request.body.username.toLowerCase() },
      });
      const valid = user
        ? await verifyPassword(request.body.password, user.passwordHash)
        : (await hashPassword(request.body.password), false);
      if (!valid || !user)
        return reply.code(401).send({ message: 'Incorrect username or password' });
      await createSession(user.id, reply);
      return { user: { id: user.id, username: user.username, role: user.role } };
    },
  );
  app.post('/api/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await db.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.code(204).send();
  });
}
