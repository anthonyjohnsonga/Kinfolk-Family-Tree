import Fastify, { type FastifyError } from 'fastify';
import { db } from './db.js';

const app = Fastify({ logger: true, bodyLimit: 1_000_000 });

app.get('/health', async () => {
  await db.$queryRaw`SELECT 1`;
  return { status: 'ok' };
});

app.get('/api/trees', async () => db.familyTree.findMany({
  orderBy: { updatedAt: 'desc' },
  select: { id:true, name:true, createdAt:true, updatedAt:true, _count:{select:{people:true}} }
}));

app.post<{Body:{name:string;firstPerson?:{name:string;birthDate?:string}}}>('/api/trees', {
  schema:{body:{type:'object',additionalProperties:false,required:['name'],properties:{name:{type:'string',minLength:1,maxLength:80},firstPerson:{type:'object',additionalProperties:false,required:['name'],properties:{name:{type:'string',minLength:1,maxLength:80},birthDate:{type:'string',format:'date'}}}}}}
}, async (request, reply) => {
  const tree = await db.familyTree.create({data:{name:request.body.name.trim(),people:request.body.firstPerson?{create:{name:request.body.firstPerson.name.trim(),birthDate:request.body.firstPerson.birthDate?new Date(`${request.body.firstPerson.birthDate}T00:00:00Z`):undefined}}:undefined},include:{people:true}});
  return reply.code(201).send(tree);
});

app.get<{Params:{id:string}}>('/api/trees/:id', async (request, reply) => {
  const tree=await db.familyTree.findUnique({where:{id:request.params.id},include:{people:true}});
  return tree || reply.code(404).send({message:'Tree not found'});
});

app.post<{Params:{treeId:string};Body:{name:string;birthDate?:string;deathDate?:string;bio?:string}}>('/api/trees/:treeId/people', {
  schema:{body:{type:'object',additionalProperties:false,required:['name'],properties:{name:{type:'string',minLength:1,maxLength:80},birthDate:{type:'string',format:'date'},deathDate:{type:'string',format:'date'},bio:{type:'string',maxLength:2000}}}}
}, async (request, reply) => {
  const tree=await db.familyTree.findUnique({where:{id:request.params.treeId},select:{id:true}}); if(!tree) return reply.code(404).send({message:'Tree not found'});
  const person=await db.person.create({data:{treeId:tree.id,name:request.body.name.trim(),birthDate:request.body.birthDate?new Date(`${request.body.birthDate}T00:00:00Z`):undefined,deathDate:request.body.deathDate?new Date(`${request.body.deathDate}T00:00:00Z`):undefined,bio:request.body.bio?.trim()}});
  return reply.code(201).send(person);
});

app.setErrorHandler((error:FastifyError, _request, reply) => { app.log.error(error); reply.code(error.statusCode || 500).send({message:error.statusCode ? error.message : 'Internal server error'}); });
app.addHook('onClose', async () => db.$disconnect());

const port=Number(process.env.PORT || 3000);
await app.listen({host:'0.0.0.0',port});
