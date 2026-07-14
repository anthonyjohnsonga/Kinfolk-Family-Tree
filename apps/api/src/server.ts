import Fastify, { type FastifyError } from 'fastify';
import cookie from '@fastify/cookie';
import { db } from './db.js';
import { currentUser, registerAuthRoutes } from './auth.js';
import { registerTreeRoutes } from './trees.js';
import { registerPeopleRoutes } from './people.js';

const app = Fastify({ logger: true, bodyLimit: 1_000_000 });
await app.register(cookie);

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
});
registerTreeRoutes(app);
registerPeopleRoutes(app);
app.setErrorHandler((error: FastifyError, _request, reply) => {
  app.log.error(error);
  reply
    .code(error.statusCode || 500)
    .send({ message: error.statusCode ? error.message : 'Internal server error' });
});
app.addHook('onClose', async () => db.$disconnect());
await app.listen({ host: '0.0.0.0', port: Number(process.env.PORT || 3000) });
