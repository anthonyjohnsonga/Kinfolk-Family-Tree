// Shared API contract: the request body shapes the API accepts and the JSON
// (wire) shapes it returns. The web app imports these types via the
// "@kinfolk/api/contract" package export, so both sides stay in sync.
// Dates cross the wire as ISO strings, so wire types use string, not Date.

export const userRoles = ['admin', 'editor', 'viewer'] as const;
export type UserRole = (typeof userRoles)[number];
export type UserAccount = { id: string; username: string; role: string; createdAt: string };

export const siblingTypes = ['sibling', 'full', 'half', 'step', 'adopted'] as const;
export type SiblingType = (typeof siblingTypes)[number];
export const lifeEventTypes = [
  'residence',
  'marriage',
  'divorce',
  'burial',
  'immigration',
  'education',
  'military',
  'occupation',
  'other',
] as const;
export type LifeEventType = (typeof lifeEventTypes)[number];
export const partnershipStatuses = ['partnered', 'married', 'divorced', 'widowed'] as const;
export type PartnershipStatus = (typeof partnershipStatuses)[number];

// Photos are stored in the database as bytes so they travel with backups.
// Uploads arrive as base64 to stay within the JSON API; the client downscales
// images first, so these limits are generous for portrait-sized photos.
export const photoContentTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export type PhotoContentType = (typeof photoContentTypes)[number];
export const MAX_PHOTO_BYTES = 5_000_000;
export const MAX_PHOTOS_PER_PERSON = 30;

export type PhotoInput = { data: string; contentType: PhotoContentType; caption?: string };
export type PhotoUpdate = { caption?: string | null; isPrimary?: boolean };
// Wire shape returned with each person: metadata only, never the image bytes.
// Fetch the bytes separately from GET /api/photos/:id.
export type PhotoMeta = {
  id: string;
  contentType: string;
  caption: string | null;
  isPrimary: boolean;
  order: number;
  createdAt: string;
};

export type PartnershipInput = {
  personId: string;
  status: PartnershipStatus;
  marriageDate?: string;
  divorceDate?: string;
};
export type LifeEventInput = {
  type: LifeEventType;
  date?: string;
  place?: string;
  description?: string;
};
export type PersonBody = {
  name: string;
  maidenName?: string;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  bio?: string;
  parentIds?: string[];
  partnerships?: PartnershipInput[];
  partnerId?: string;
  marriageDate?: string;
  partnershipStatus?: string;
  siblings?: { personId: string; type: SiblingType }[];
  lifeEvents?: LifeEventInput[];
  siblingId?: string;
  siblingType?: SiblingType;
};

export type ParentLink = { parentId: string; childId: string; type: string };
export type Partnership = {
  partnerAId: string;
  partnerBId: string;
  status: string;
  marriageDate: string | null;
  divorceDate: string | null;
};
export type SiblingLink = { siblingAId: string; siblingBId: string; type: string };
// id is optional because the web editor also uses this shape for unsaved drafts.
export type LifeEvent = {
  id?: string;
  type: string;
  date: string | null;
  place: string | null;
  description: string | null;
};
export type Person = {
  id: string;
  name: string;
  maidenName: string | null;
  birthDate: string | null;
  birthPlace: string | null;
  deathDate: string | null;
  deathPlace: string | null;
  bio: string | null;
  parentLinks: ParentLink[];
  partnershipsA: Partnership[];
  partnershipsB: Partnership[];
  siblingLinksA: SiblingLink[];
  siblingLinksB: SiblingLink[];
  lifeEvents: LifeEvent[];
  photos: PhotoMeta[];
};
export type Tree = {
  id: string;
  name: string;
  backgroundStyle: string;
  backgroundColor: string;
  treeColor: string;
  accentColor: string;
  people: Person[];
};
export type TreeSummary = { id: string; name: string; _count: { people: number } };
export type AuthStatus = {
  setupRequired: boolean;
  authenticated: boolean;
  user: { id: string; username: string; role: string } | null;
};
