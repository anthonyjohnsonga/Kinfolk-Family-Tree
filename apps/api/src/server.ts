import Fastify, { type FastifyError } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { db } from './db.js';
import { currentUser, registerAuthRoutes } from './auth.js';
import { registerTreeRoutes } from './trees.js';
import { registerPeopleRoutes } from './people.js';
import { registerUserRoutes } from './users.js';

// Trust exactly the bundled nginx hop so rate limiting sees the real client
// address without trusting client-supplied X-Forwarded-For entries.
const app = Fastify({ logger: true, bodyLimit: 1_000_000, trustProxy: 1 });
await app.register(cookie);
// Rate limiting is opt-in per route; the credential routes in auth.ts use it.
await app.register(rateLimit, { global: false });

app.get('/health', async () => {
  await db.$queryRaw`SELECT 1`;
  return { status: 'ok' };
});
registerAuthRoutes(app);
app.addHook('onSend', async (request, reply, payload) => {
  if (request.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
  return payload;
});
app.addHook('preHandler', async (request, reply) => {
  if (!request.url.startsWith('/api/') || request.url.startsWith('/api/auth/')) return;
  const user = await currentUser(request);
  if (!user) return reply.code(401).send({ message: 'Authentication required' });
  request.user = user;
  if (request.url.startsWith('/api/users') && user.role !== 'admin')
    return reply.code(403).send({ message: 'Administrator access required' });
  if (request.method !== 'GET' && user.role === 'viewer')
    return reply.code(403).send({ message: 'Your account has read-only access' });
});
registerTreeRoutes(app);
registerPeopleRoutes(app);
registerUserRoutes(app);
app.setErrorHandler((error: FastifyError, _request, reply) => {
  app.log.error(error);
  reply
    .code(error.statusCode || 500)
    .send({ message: error.statusCode ? error.message : 'Internal server error' });
});
app.addHook('onClose', async () => db.$disconnect());
await app.listen({ host: '0.0.0.0', port: Number(process.env.PORT || 3000) });
