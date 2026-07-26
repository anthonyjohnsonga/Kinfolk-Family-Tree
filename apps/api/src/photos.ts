import type { FastifyInstance } from 'fastify';
import { db } from './db.js';
import { treeInclude } from './queries.js';
import {
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_PERSON,
  photoContentTypes,
  type PhotoInput,
  type PhotoUpdate,
} from './contract.js';
import { photoBodySchema, photoUpdateSchema } from './schemas.js';

// A base64 upload of MAX_PHOTO_BYTES is ~4/3 larger; leave headroom for the
// surrounding JSON. nginx already allows a 10m request body.
const UPLOAD_BODY_LIMIT = 8_000_000;

export class PhotoError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

// Pure decoder shared by the route and its tests: validates the content type
// and the decoded byte length, returning the raw image bytes. Prisma's Bytes
// column takes a plain Uint8Array, so we hand back one rather than a Buffer.
export function decodePhoto(input: PhotoInput): Uint8Array<ArrayBuffer> {
  if (!photoContentTypes.includes(input.contentType))
    throw new PhotoError(400, 'Unsupported image type');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.data))
    throw new PhotoError(400, 'Image data is not valid base64');
  const decoded = Buffer.from(input.data, 'base64');
  if (decoded.length === 0) throw new PhotoError(400, 'Image data is empty');
  if (decoded.length > MAX_PHOTO_BYTES) throw new PhotoError(413, 'Image is too large');
  // Copy into an ArrayBuffer-backed view, which is what Prisma's Bytes expects.
  const bytes = new Uint8Array(decoded.length);
  bytes.set(decoded);
  return bytes;
}

export function registerPhotoRoutes(app: FastifyInstance) {
  const treeForPerson = async (personId: string) => {
    const person = await db.person.findUnique({
      where: { id: personId },
      select: { treeId: true },
    });
    if (!person) return null;
    await db.familyTree.update({
      where: { id: person.treeId },
      data: { updatedAt: new Date() },
    });
    return db.familyTree.findUnique({ where: { id: person.treeId }, include: treeInclude });
  };

  app.post<{ Params: { id: string }; Body: PhotoInput }>(
    '/api/people/:id/photos',
    { bodyLimit: UPLOAD_BODY_LIMIT, schema: { body: photoBodySchema } },
    async (request, reply) => {
      const person = await db.person.findUnique({
        where: { id: request.params.id },
        select: { id: true, _count: { select: { photos: true } } },
      });
      if (!person) return reply.code(404).send({ message: 'Person not found' });
      if (person._count.photos >= MAX_PHOTOS_PER_PERSON)
        return reply
          .code(422)
          .send({ message: `A person can have at most ${MAX_PHOTOS_PER_PERSON} photos` });
      let data: Uint8Array<ArrayBuffer>;
      try {
        data = decodePhoto(request.body);
      } catch (error) {
        if (error instanceof PhotoError)
          return reply.code(error.statusCode).send({ message: error.message });
        throw error;
      }
      const last = await db.photo.findFirst({
        where: { personId: person.id },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      await db.photo.create({
        data: {
          personId: person.id,
          data,
          contentType: request.body.contentType,
          caption: request.body.caption?.trim() || null,
          // The first photo a person receives becomes their profile picture.
          isPrimary: person._count.photos === 0,
          order: (last?.order ?? -1) + 1,
        },
      });
      return reply.code(201).send(await treeForPerson(person.id));
    },
  );

  app.get<{ Params: { id: string } }>('/api/photos/:id', async (request, reply) => {
    const photo = await db.photo.findUnique({
      where: { id: request.params.id },
      select: { data: true, contentType: true },
    });
    if (!photo) return reply.code(404).send({ message: 'Photo not found' });
    // A photo's bytes never change once uploaded, so it is safe to cache hard.
    reply.header('Content-Type', photo.contentType);
    reply.header('Cache-Control', 'private, max-age=604800, immutable');
    return reply.send(Buffer.from(photo.data));
  });

  app.patch<{ Params: { id: string }; Body: PhotoUpdate }>(
    '/api/photos/:id',
    { schema: { body: photoUpdateSchema } },
    async (request, reply) => {
      const photo = await db.photo.findUnique({
        where: { id: request.params.id },
        select: { id: true, personId: true },
      });
      if (!photo) return reply.code(404).send({ message: 'Photo not found' });
      const caption =
        request.body.caption === undefined ? undefined : request.body.caption?.trim() || null;
      await db.$transaction(async (tx) => {
        // Only one profile photo per person: clear the others before promoting.
        if (request.body.isPrimary === true)
          await tx.photo.updateMany({
            where: { personId: photo.personId, id: { not: photo.id } },
            data: { isPrimary: false },
          });
        await tx.photo.update({
          where: { id: photo.id },
          data: {
            caption,
            ...(request.body.isPrimary === undefined ? {} : { isPrimary: request.body.isPrimary }),
          },
        });
      });
      return treeForPerson(photo.personId);
    },
  );

  app.delete<{ Params: { id: string } }>('/api/photos/:id', async (request, reply) => {
    const photo = await db.photo.findUnique({
      where: { id: request.params.id },
      select: { id: true, personId: true, isPrimary: true },
    });
    if (!photo) return reply.code(404).send({ message: 'Photo not found' });
    await db.$transaction(async (tx) => {
      await tx.photo.delete({ where: { id: photo.id } });
      // If the profile photo was removed, promote the next remaining one.
      if (photo.isPrimary) {
        const next = await tx.photo.findFirst({
          where: { personId: photo.personId },
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
          select: { id: true },
        });
        if (next) await tx.photo.update({ where: { id: next.id }, data: { isPrimary: true } });
      }
    });
    return treeForPerson(photo.personId);
  });
}
