// Shared API contract: the request body shapes the API accepts and the JSON
// (wire) shapes it returns. The web app imports these types via the
// "@kinfolk/api/contract" package export, so both sides stay in sync.
// Dates cross the wire as ISO strings, so wire types use string, not Date.

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
