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

// Partial-date support. A date is stored as a canonical token: an optional
// qualifier prefix — "~" (about/circa), "<" (before), ">" (after) — followed
// by a year, year-month, or full day. Examples: "1880", "~1880", "1950-03",
// ">1900-06-15". The API also keeps the resolved earliest instant (a DateTime)
// alongside the token so dates still sort chronologically.
export const DATE_TOKEN_PATTERN = '^[~<>]?\\d{4}(-\\d{2}(-\\d{2})?)?$';
export type DatePrecision = 'year' | 'month' | 'day';
export type DateQualifier = 'exact' | 'about' | 'before' | 'after';

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

// Sources are the evidence behind a fact, and they are shared by every tree
// rather than owned by one: the same census page or family Bible documents
// people across trees. Listing is capped and searchable because a library
// accumulates for as long as the research does.
export const MAX_SOURCE_RESULTS = 200;
export type SourceInput = {
  title: string;
  author?: string;
  publication?: string;
  repository?: string;
  notes?: string;
};
// Every field but the title is optional: real sources are often half-known,
// and refusing to record a half-known one loses the evidence entirely.
export type SourceRecord = {
  id: string;
  title: string;
  author: string | null;
  publication: string | null;
  repository: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
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

// Request date fields (birthDate, deathDate, marriageDate, divorceDate,
// lifeEvents[].date) carry a partial-date token, not a plain ISO date. The
// responses below return both the resolved ISO date (for sorting) and the
// original token (for display and editing).
export type ParentLink = { parentId: string; childId: string; type: string };
export type Partnership = {
  partnerAId: string;
  partnerBId: string;
  status: string;
  marriageDate: string | null;
  marriageDateToken: string | null;
  divorceDate: string | null;
  divorceDateToken: string | null;
};
export type SiblingLink = { siblingAId: string; siblingBId: string; type: string };
// id is optional because the web editor also uses this shape for unsaved drafts.
export type LifeEvent = {
  id?: string;
  type: string;
  date: string | null;
  dateToken?: string | null;
  place: string | null;
  description: string | null;
};
export type Person = {
  id: string;
  name: string;
  maidenName: string | null;
  birthDate: string | null;
  birthDateToken: string | null;
  birthPlace: string | null;
  deathDate: string | null;
  deathDateToken: string | null;
  deathPlace: string | null;
  bio: string | null;
  parentLinks: ParentLink[];
  // Children who live in another tree. Same-tree children are absent: they are
  // already described by that child's own parentLinks.
  childLinks: ParentLink[];
  partnershipsA: Partnership[];
  partnershipsB: Partnership[];
  siblingLinksA: SiblingLink[];
  siblingLinksB: SiblingLink[];
  lifeEvents: LifeEvent[];
  photos: PhotoMeta[];
};
// A person in another tree that this tree links to. Carries only what it takes
// to draw and label the far end of the edge; open their tree for the rest.
export type ForeignPerson = {
  id: string;
  name: string;
  treeId: string;
  treeName: string;
  birthDateToken: string | null;
  deathDateToken: string | null;
};
// One hit from GET /api/people?q= — the cross-tree people search behind the
// relative pickers. Like ForeignPerson but with the maiden name, because the
// picker has to tell two people with the same married name apart. Results are
// capped: this is a picker, not a report.
export const MAX_PEOPLE_SEARCH_RESULTS = 25;
export type PersonSearchResult = {
  id: string;
  name: string;
  maidenName: string | null;
  treeId: string;
  treeName: string;
  birthDateToken: string | null;
  deathDateToken: string | null;
};
export type Tree = {
  id: string;
  name: string;
  backgroundStyle: string;
  backgroundColor: string;
  treeColor: string;
  accentColor: string;
  people: Person[];
  foreignPeople: ForeignPerson[];
};
export type TreeSummary = { id: string; name: string; _count: { people: number } };
export type AuthStatus = {
  setupRequired: boolean;
  authenticated: boolean;
  user: { id: string; username: string; role: string } | null;
};
