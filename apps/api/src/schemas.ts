import {
  DATE_TOKEN_PATTERN,
  MAX_PEOPLE_SEARCH_RESULTS,
  lifeEventTypes,
  partnershipStatuses,
  photoContentTypes,
  siblingTypes,
} from './contract.js';

// Dates arrive as partial-date tokens (see contract.ts), not strict ISO dates.
const dateToken = { type: 'string', pattern: DATE_TOKEN_PATTERN } as const;

export const personBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 80 },
    maidenName: { type: 'string', maxLength: 80 },
    birthDate: dateToken,
    birthPlace: { type: 'string', maxLength: 160 },
    deathDate: dateToken,
    deathPlace: { type: 'string', maxLength: 160 },
    bio: { type: 'string', maxLength: 2000 },
    parentIds: {
      type: 'array',
      maxItems: 2,
      uniqueItems: true,
      items: { type: 'string', format: 'uuid' },
    },
    partnerships: {
      type: 'array',
      maxItems: 50,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['personId', 'status'],
        properties: {
          personId: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: partnershipStatuses },
          marriageDate: dateToken,
          divorceDate: dateToken,
        },
      },
    },
    partnerId: { type: 'string', format: 'uuid' },
    marriageDate: dateToken,
    partnershipStatus: { type: 'string', enum: partnershipStatuses },
    siblings: {
      type: 'array',
      maxItems: 100,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['personId', 'type'],
        properties: {
          personId: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: siblingTypes },
        },
      },
    },
    lifeEvents: {
      type: 'array',
      maxItems: 200,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type'],
        properties: {
          type: { type: 'string', enum: lifeEventTypes },
          date: dateToken,
          place: { type: 'string', maxLength: 160 },
          description: { type: 'string', maxLength: 1000 },
        },
      },
    },
    siblingId: { type: 'string', format: 'uuid' },
    siblingType: { type: 'string', enum: siblingTypes },
  },
} as const;

export const peopleSearchQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    // A missing or blank q matches nobody; see searchPeople in search.ts.
    q: { type: 'string', maxLength: 120 },
    limit: { type: 'integer', minimum: 1, maximum: MAX_PEOPLE_SEARCH_RESULTS },
  },
} as const;

export const photoBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['data', 'contentType'],
  properties: {
    // Base64 payload; the byte-length limit is enforced after decoding.
    data: { type: 'string', minLength: 1, maxLength: 7_000_000 },
    contentType: { type: 'string', enum: photoContentTypes },
    caption: { type: 'string', maxLength: 200 },
  },
} as const;

export const photoUpdateSchema = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: {
    caption: { type: ['string', 'null'], maxLength: 200 },
    isPrimary: { type: 'boolean' },
  },
} as const;
