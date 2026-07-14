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
} from '@kinfolk/api/contract';

export type SiblingDraft = { personId: string; type: string };
