import Fastify, { type FastifyError } from 'fastify';
import { db } from './db.js';

const app = Fastify({ logger: true, bodyLimit: 1_000_000 });
const date = (value?:string) => value ? new Date(`${value}T00:00:00Z`) : null;
const ordered = (a:string,b:string) => a < b ? [a,b] : [b,a];
const personBodySchema = {type:'object',additionalProperties:false,required:['name'],properties:{name:{type:'string',minLength:1,maxLength:80},birthDate:{type:'string',format:'date'},deathDate:{type:'string',format:'date'},bio:{type:'string',maxLength:2000},parentIds:{type:'array',maxItems:2,uniqueItems:true,items:{type:'string',format:'uuid'}},partnerId:{type:'string',format:'uuid'},marriageDate:{type:'string',format:'date'},partnershipStatus:{type:'string',enum:['partnered','married']},siblingId:{type:'string',format:'uuid'},siblingType:{type:'string',enum:['sibling','full','half','step','adopted']}}} as const;
type PersonBody={name:string;birthDate?:string;deathDate?:string;bio?:string;parentIds?:string[];partnerId?:string;marriageDate?:string;partnershipStatus?:string;siblingId?:string;siblingType?:string};

const treeInclude={people:{orderBy:{createdAt:'asc' as const},include:{parentLinks:true,partnershipsA:true,partnershipsB:true,siblingLinksA:true,siblingLinksB:true}}};

async function assertMembers(treeId:string, ids:string[]) {
  const unique=[...new Set(ids.filter(Boolean))]; if(!unique.length)return;
  const count=await db.person.count({where:{treeId,id:{in:unique}}});
  if(count!==unique.length) throw Object.assign(new Error('Every relationship must belong to the same tree'),{statusCode:400});
}

async function syncRelationships(personId:string,treeId:string,body:PersonBody) {
  const relationIds=[...(body.parentIds||[]),body.partnerId||'',body.siblingId||''];
  if(relationIds.includes(personId)) throw Object.assign(new Error('A person cannot be related to themselves'),{statusCode:400});
  await assertMembers(treeId,relationIds);
  await db.$transaction(async tx=>{
    await tx.parentRelationship.deleteMany({where:{childId:personId}});
    if(body.parentIds?.length) await tx.parentRelationship.createMany({data:body.parentIds.map(parentId=>({treeId,parentId,childId:personId}))});
    await tx.partnership.deleteMany({where:{OR:[{partnerAId:personId},{partnerBId:personId},...(body.partnerId?[{partnerAId:body.partnerId},{partnerBId:body.partnerId}]:[])]}});
    if(body.partnerId){
      const [partnerAId,partnerBId]=ordered(personId,body.partnerId);
      await tx.partnership.upsert({where:{partnerAId_partnerBId:{partnerAId,partnerBId}},create:{treeId,partnerAId,partnerBId,status:body.partnershipStatus||'partnered',marriageDate:date(body.marriageDate)},update:{status:body.partnershipStatus||'partnered',marriageDate:date(body.marriageDate)}});
    }
    if(body.siblingId){
      const [siblingAId,siblingBId]=ordered(personId,body.siblingId);
      await tx.siblingRelationship.upsert({where:{siblingAId_siblingBId:{siblingAId,siblingBId}},create:{treeId,siblingAId,siblingBId,type:body.siblingType||'sibling'},update:{type:body.siblingType||'sibling'}});
    }
  });
}

app.get('/health',async()=>{await db.$queryRaw`SELECT 1`;return{status:'ok'}});
app.get('/api/trees',async()=>db.familyTree.findMany({orderBy:{updatedAt:'desc'},select:{id:true,name:true,createdAt:true,updatedAt:true,_count:{select:{people:true}}}}));
app.post<{Body:{name:string;firstPerson?:{name:string;birthDate?:string}}}>('/api/trees',{schema:{body:{type:'object',additionalProperties:false,required:['name'],properties:{name:{type:'string',minLength:1,maxLength:80},firstPerson:{type:'object',additionalProperties:false,required:['name'],properties:{name:{type:'string',minLength:1,maxLength:80},birthDate:{type:'string',format:'date'}}}}}}},async(request,reply)=>reply.code(201).send(await db.familyTree.create({data:{name:request.body.name.trim(),people:request.body.firstPerson?{create:{name:request.body.firstPerson.name.trim(),birthDate:date(request.body.firstPerson.birthDate)}}:undefined},include:treeInclude})));
app.get<{Params:{id:string}}>('/api/trees/:id',async(request,reply)=>{const tree=await db.familyTree.findUnique({where:{id:request.params.id},include:treeInclude});return tree||reply.code(404).send({message:'Tree not found'})});
app.patch<{Params:{id:string};Body:{name?:string;backgroundStyle?:string;backgroundColor?:string;treeColor?:string;accentColor?:string}}>('/api/trees/:id',{schema:{body:{type:'object',additionalProperties:false,properties:{name:{type:'string',minLength:1,maxLength:80},backgroundStyle:{enum:['botanical','classic','minimal']},backgroundColor:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'},treeColor:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'},accentColor:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'}}}}},async(request,reply)=>{try{return await db.familyTree.update({where:{id:request.params.id},data:request.body,include:treeInclude})}catch{return reply.code(404).send({message:'Tree not found'})}});
app.post<{Params:{treeId:string};Body:PersonBody}>('/api/trees/:treeId/people',{schema:{body:personBodySchema}},async(request,reply)=>{const tree=await db.familyTree.findUnique({where:{id:request.params.treeId},select:{id:true}});if(!tree)return reply.code(404).send({message:'Tree not found'});const person=await db.person.create({data:{treeId:tree.id,name:request.body.name.trim(),birthDate:date(request.body.birthDate),deathDate:date(request.body.deathDate),bio:request.body.bio?.trim()}});await syncRelationships(person.id,tree.id,request.body);await db.familyTree.update({where:{id:tree.id},data:{updatedAt:new Date()}});return reply.code(201).send(await db.familyTree.findUnique({where:{id:tree.id},include:treeInclude}))});
app.patch<{Params:{id:string};Body:PersonBody}>('/api/people/:id',{schema:{body:personBodySchema}},async(request,reply)=>{const existing=await db.person.findUnique({where:{id:request.params.id}});if(!existing)return reply.code(404).send({message:'Person not found'});await db.person.update({where:{id:existing.id},data:{name:request.body.name.trim(),birthDate:date(request.body.birthDate),deathDate:date(request.body.deathDate),bio:request.body.bio?.trim()}});await syncRelationships(existing.id,existing.treeId,request.body);await db.familyTree.update({where:{id:existing.treeId},data:{updatedAt:new Date()}});return db.familyTree.findUnique({where:{id:existing.treeId},include:treeInclude})});
app.delete<{Params:{id:string}}>('/api/people/:id',async(request,reply)=>{const existing=await db.person.findUnique({where:{id:request.params.id}});if(!existing)return reply.code(404).send({message:'Person not found'});await db.person.delete({where:{id:existing.id}});await db.familyTree.update({where:{id:existing.treeId},data:{updatedAt:new Date()}});return reply.code(204).send()});
app.setErrorHandler((error:FastifyError,_request,reply)=>{app.log.error(error);reply.code(error.statusCode||500).send({message:error.statusCode?error.message:'Internal server error'})});
app.addHook('onClose',async()=>db.$disconnect());
await app.listen({host:'0.0.0.0',port:Number(process.env.PORT||3000)});
