// WHO A HELD ORDER IS WAITING ON, IN WORDS: one door onto the sign-off/ words.
export { heldOrderNotice } from './sign-off/held-order-words';
export type { HeldOrderNotice } from './sign-off/held-order-words';
export { approvedStockNotice } from './sign-off/approved-stock';
export type {
  ApprovedStock,
  ApprovedStockNotice,
  ApprovedStockLine,
} from './sign-off/approved-stock';
export { approveOutcome, approveWords, rejectWords } from './sign-off/decision-words';
export type { DecisionFacts } from './sign-off/decision-words';
export { queueSignOffView } from './sign-off/queue-words';
export type { QueueSignOffView } from './sign-off/queue-words';
export { accountApproversOption, ruleSignOffNote } from './sign-off/rule-words';
export type { SignOffRule, SignOffNote } from './sign-off/rule-words';
export { peopleWords } from './sign-off/people-words';
export type {
  AccountApprover,
  SignOff,
  SignOffSide,
  SignOffTone,
  DayFormat,
} from './sign-off/people-words';

/* ── The account's contacts ────────────────────────────────────────────── */

/** What "Can approve orders" does, for the people choosing it. */
export const APPROVER_ROLE_MEANING =
  'Someone who can approve orders says yes, on your site, to any order held by a spending ' +
  'limit you set to the customer’s own approvers under Approvals.';
