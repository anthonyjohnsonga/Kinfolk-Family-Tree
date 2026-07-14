import type { FastifyInstance } from 'fastify';
import { db } from './db.js';
import { date } from './utils.js';
import { treeInclude } from './queries.js';

export function registerTreeRoutes(app:FastifyInstance){
 app.get('/api/trees',async()=>db.familyTree.findMany({orderBy:{updatedAt:'desc'},select:{id:true,name:true,createdAt:true,updatedAt:true,_count:{select:{people:true}}}}));
 app.post<{Body:{name:string;firstPerson?:{name:string;birthDate?:string}}}>('/api/trees',{schema:{body:{type:'object',additionalProperties:false,required:['name'],properties:{name:{type:'string',minLength:1,maxLength:80},firstPerson:{type:'object',additionalProperties:false,required:['name'],properties:{name:{type:'string',minLength:1,maxLength:80},birthDate:{type:'string',format:'date'}}}}}}},async(request,reply)=>reply.code(201).send(await db.familyTree.create({data:{name:request.body.name.trim(),people:request.body.firstPerson?{create:{name:request.body.firstPerson.name.trim(),birthDate:date(request.body.firstPerson.birthDate)}}:undefined},include:treeInclude})));
 app.get<{Params:{id:string}}>('/api/trees/:id',async(request,reply)=>{const tree=await db.familyTree.findUnique({where:{id:request.params.id},include:treeInclude});return tree||reply.code(404).send({message:'Tree not found'})});
 app.patch<{Params:{id:string};Body:{name?:string;backgroundStyle?:string;backgroundColor?:string;treeColor?:string;accentColor?:string}}>('/api/trees/:id',{schema:{body:{type:'object',additionalProperties:false,properties:{name:{type:'string',minLength:1,maxLength:80},backgroundStyle:{enum:['botanical','classic','minimal']},backgroundColor:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'},treeColor:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'},accentColor:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'}}}}},async(request,reply)=>{try{return await db.familyTree.update({where:{id:request.params.id},data:request.body,include:treeInclude})}catch{return reply.code(404).send({message:'Tree not found'})}});
}
