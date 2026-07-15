import { lifeEventTypes, partnershipStatuses, siblingTypes } from './contract.js';

export const personBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 80 },
    maidenName: { type: 'string', maxLength: 80 },
    birthDate: { type: 'string', format: 'date' },
    birthPlace: { type: 'string', maxLength: 160 },
    deathDate: { type: 'string', format: 'date' },
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
          marriageDate: { type: 'string', format: 'date' },
          divorceDate: { type: 'string', format: 'date' },
        },
      },
    },
    partnerId: { type: 'string', format: 'uuid' },
    marriageDate: { type: 'string', format: 'date' },
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
          date: { type: 'string', format: 'date' },
          place: { type: 'string', maxLength: 160 },
          description: { type: 'string', maxLength: 1000 },
        },
      },
    },
    siblingId: { type: 'string', format: 'uuid' },
    siblingType: { type: 'string', enum: siblingTypes },
  },
} as const;
