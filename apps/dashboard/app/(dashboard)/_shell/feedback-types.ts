// In-product feedback — shared types (docs/112). Imported by both the server
// actions (feedback-actions.ts) and the client feedback UI, so it carries no
// 'use server' / 'server-only' directive.

export type FeedbackCategory = 'idea' | 'problem' | 'question' | 'praise';
export type FeedbackSource = 'button' | 'pulse' | 'command';

// Triage lifecycle (docs/apps/admin/feedback.md §6). The dashboard only ever
// reads these; the admin app owns the transitions.
export type FeedbackStatus =
  | 'new'
  | 'triaged'
  | 'planned'
  | 'in_progress'
  | 'shipped'
  | 'declined'
  | 'answered';

export type FeedbackAuthorKind = 'staff' | 'user';

/** The captured client context (docs/112 §4). All optional — advisory metadata
 *  the modal shows back to the user; never trusted for identity. */
export interface FeedbackContextPayload {
  route?: string;
  routePattern?: string | null;
  module?: string | null;
  section?: string | null;
  entity?: { type: string; id: string } | null;
  pageTitle?: string | null;
  property?: { id: string; name: string } | null;
  trail?: string[];
  viewport?: { width: number; height: number };
  device?: 'desktop' | 'tablet' | 'mobile';
  theme?: 'light' | 'dark';
  locale?: string;
  appVersion?: string;
  userAgent?: string;
}

export interface FeedbackSubmissionInput {
  category: FeedbackCategory;
  subject?: string;
  body: string;
  sentiment?: number;
  source: FeedbackSource;
  context: FeedbackContextPayload;
  attachmentAssetIds?: string[];
}

export interface FeedbackSubmission {
  id: string;
  source: FeedbackSource;
  category: FeedbackCategory;
  subject: string | null;
  body: string;
  sentiment: number | null;
  status: FeedbackStatus;
  context: FeedbackContextPayload;
  attachmentAssetIds: string[];
  lastResponseAt: string | null;
  userUnread: boolean;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

export interface FeedbackMessageRow {
  id: string;
  authorKind: FeedbackAuthorKind;
  authorName: string;
  body: string;
  attachmentAssetIds: string[];
  createdAt: string;
}

export interface FeedbackThread extends FeedbackSubmission {
  messages: FeedbackMessageRow[];
}

export interface FeedbackListResult {
  items: FeedbackSubmission[];
  unreadCount: number;
}

// Submit returns a discriminated result (not a throw) so the friendly server
// message — e.g. the soft rate-limit notice — reaches the client intact. Thrown
// errors out of a Server Action get their message redacted in production.
export type FeedbackSubmitResult =
  | { ok: true; submission: FeedbackSubmission }
  | { ok: false; error: string };

export interface PulseDescriptor {
  promptId: string;
  kind: 'sentiment';
  question: string;
}

export type PulseAction = 'shown' | 'dismissed' | 'answered';

// Category presentation — label + the lucide icon name resolved in the UI.
export const FEEDBACK_CATEGORIES: readonly {
  value: FeedbackCategory;
  label: string;
  hint: string;
}[] = [
  { value: 'idea', label: 'Idea', hint: 'A suggestion or feature request' },
  { value: 'problem', label: 'Problem', hint: 'Something is broken or confusing' },
  { value: 'question', label: 'Question', hint: 'Ask us something' },
  { value: 'praise', label: 'Praise', hint: 'Tell us what you love' },
];

// Human labels for the lifecycle statuses shown in the history view.
export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: 'New',
  triaged: 'Seen',
  planned: 'Planned',
  in_progress: 'In progress',
  shipped: 'Shipped',
  declined: 'Declined',
  answered: 'Answered',
};
