import { db } from './db.js';
import { date, ordered } from './utils.js';
import type { PersonBody } from './schemas.js';

async function assertMembers(treeId: string, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return;
  const count = await db.person.count({ where: { treeId, id: { in: unique } } });
  if (count !== unique.length)
    throw Object.assign(new Error('Every relationship must belong to the same tree'), {
      statusCode: 400,
    });
}

export async function syncRelationships(personId: string, treeId: string, body: PersonBody) {
  const siblingIds = body.siblings?.map((sibling) => sibling.personId) || [];
  if (new Set(siblingIds).size !== siblingIds.length)
    throw Object.assign(new Error('Each sibling can be selected only once'), { statusCode: 400 });
  const relationIds = [
    ...(body.parentIds || []),
    body.partnerId || '',
    ...siblingIds,
    body.siblingId || '',
  ];
  if (relationIds.includes(personId))
    throw Object.assign(new Error('A person cannot be related to themselves'), { statusCode: 400 });
  await assertMembers(treeId, relationIds);
  await db.$transaction(async (tx) => {
    await tx.parentRelationship.deleteMany({ where: { childId: personId } });
    if (body.parentIds?.length)
      await tx.parentRelationship.createMany({
        data: body.parentIds.map((parentId) => ({ treeId, parentId, childId: personId })),
      });
    await tx.partnership.deleteMany({
      where: {
        OR: [
          { partnerAId: personId },
          { partnerBId: personId },
          ...(body.partnerId
            ? [{ partnerAId: body.partnerId }, { partnerBId: body.partnerId }]
            : []),
        ],
      },
    });
    if (body.partnerId) {
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

export async function syncLifeEvents(personId: string, body: PersonBody) {
  if (!body.lifeEvents) return;
  await db.$transaction(async (tx) => {
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
