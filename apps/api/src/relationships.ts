import { db } from './db.js';
import { date, ordered } from './utils.js';
import type { PersonBody } from './contract.js';

async function assertMembers(treeId: string, ids: string[], client: typeof db) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return;
  const count = await client.person.count({ where: { treeId, id: { in: unique } } });
  if (count !== unique.length)
    throw Object.assign(new Error('Every relationship must belong to the same tree'), {
      statusCode: 400,
    });
}

// The client parameter exists so tests can substitute a recording fake.
export async function syncRelationships(
  personId: string,
  treeId: string,
  body: PersonBody,
  client: typeof db = db,
) {
  const siblingIds = body.siblings?.map((sibling) => sibling.personId) || [];
  if (new Set(siblingIds).size !== siblingIds.length)
    throw Object.assign(new Error('Each sibling can be selected only once'), { statusCode: 400 });
  const partnershipIds = body.partnerships?.map((partnership) => partnership.personId) || [];
  if (new Set(partnershipIds).size !== partnershipIds.length)
    throw Object.assign(new Error('Each partner can be selected only once'), { statusCode: 400 });
  const relationIds = [
    ...(body.parentIds || []),
    ...partnershipIds,
    body.partnerId || '',
    ...siblingIds,
    body.siblingId || '',
  ];
  if (relationIds.includes(personId))
    throw Object.assign(new Error('A person cannot be related to themselves'), { statusCode: 400 });
  await assertMembers(treeId, relationIds, client);
  await client.$transaction(async (tx) => {
    await tx.parentRelationship.deleteMany({ where: { childId: personId } });
    if (body.parentIds?.length)
      await tx.parentRelationship.createMany({
        data: body.parentIds.map((parentId) => ({ treeId, parentId, childId: personId })),
      });
    if (body.partnerships) {
      await tx.partnership.deleteMany({
        where: { OR: [{ partnerAId: personId }, { partnerBId: personId }] },
      });
      if (body.partnerships.length)
        await tx.partnership.createMany({
          data: body.partnerships.map((partnership) => {
            const [partnerAId, partnerBId] = ordered(personId, partnership.personId);
            return {
              treeId,
              partnerAId,
              partnerBId,
              status: partnership.status,
              marriageDate: date(partnership.marriageDate),
              divorceDate: date(partnership.divorceDate),
            };
          }),
        });
    } else if (body.partnerId) {
      const [partnerAId, partnerBId] = ordered(personId, body.partnerId);
      await tx.partnership.upsert({
        where: { partnerAId_partnerBId: { partnerAId, partnerBId } },
        create: {
          treeId,
          partnerAId,
          partnerBId,
          status: body.partnershipStatus || 'partnered',
          marriageDate: date(body.marriageDate),
        },
        update: {
          status: body.partnershipStatus || 'partnered',
          marriageDate: date(body.marriageDate),
        },
      });
    }
    if (body.siblings) {
      await tx.siblingRelationship.deleteMany({
        where: { OR: [{ siblingAId: personId }, { siblingBId: personId }] },
      });
      if (body.siblings.length)
        await tx.siblingRelationship.createMany({
          data: body.siblings.map((sibling) => {
            const [siblingAId, siblingBId] = ordered(personId, sibling.personId);
            return { treeId, siblingAId, siblingBId, type: sibling.type };
          }),
        });
    } else if (body.siblingId) {
      const [siblingAId, siblingBId] = ordered(personId, body.siblingId);
      await tx.siblingRelationship.upsert({
        where: { siblingAId_siblingBId: { siblingAId, siblingBId } },
        create: { treeId, siblingAId, siblingBId, type: body.siblingType || 'sibling' },
        update: { type: body.siblingType || 'sibling' },
      });
    }
  });
}

export async function syncLifeEvents(personId: string, body: PersonBody, client: typeof db = db) {
  if (!body.lifeEvents) return;
  await client.$transaction(async (tx) => {
    await tx.lifeEvent.deleteMany({ where: { personId } });
    if (body.lifeEvents?.length)
      await tx.lifeEvent.createMany({
        data: body.lifeEvents.map((event) => ({
          personId,
          type: event.type,
          date: date(event.date),
          place: event.place?.trim() || null,
          description: event.description?.trim() || null,
        })),
      });
  });
}
