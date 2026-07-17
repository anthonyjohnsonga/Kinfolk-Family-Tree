// The API defines the shared contract; only UI-local shapes live here.
// Import types only — the web bundle must not pull in API runtime code.
export type {
  AuthStatus,
  LifeEvent,
  ParentLink,
  Partnership,
  Person,
  SiblingLink,
  Tree,
  TreeSummary,
  UserAccount,
} from '@kinfolk/api/contract';

export type SessionUser = { id: string; username: string; role: string };

export type SiblingDraft = { personId: string; type: string };
export type PartnershipDraft = {
  personId: string;
  status: string;
  marriageDate: string;
  divorceDate: string;
};
