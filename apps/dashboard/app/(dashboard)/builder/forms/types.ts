// Local DTO types + tiny formatters for the Form submissions inbox (docs/115).
//
// The dashboard is a Next app and MUST NOT import `@sparx/db` types, so the
// FormSubmission shape is defined here from the api-rest response
// (GET /v1/forms/submissions[/:id]) rather than from the Prisma model.

export type FormSubmissionStatus = 'new' | 'read' | 'spam' | 'archived';

// The `context` blob the public endpoint captures alongside each submission.
export interface FormSubmissionContext {
  ip?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  submittedAt?: string | null;
}

// A visitor-uploaded file (docs/115 Part D). The api-rest inbox response carries
// only display metadata — never the private storage key. Bytes are pulled through
// the authenticated dashboard download route, addressed by INDEX.
export interface FormSubmissionAttachment {
  filename: string;
  mimeType: string;
  byteSize: number;
}

export interface FormSubmission {
  id: string;
  propertyId: string | null;
  formNodeId: string;
  pageSlug: string | null;
  formName: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  // The full posted field set (a superset of name/email/phone/message).
  fields: Record<string, string>;
  // Files the visitor attached (display metadata only — no storage key).
  attachments: FormSubmissionAttachment[];
  context: FormSubmissionContext;
  status: FormSubmissionStatus;
  // Set once the lead has been mirrored into the CRM as a prospect.
  customerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionCounts {
  total: number;
  new: number;
}

export interface SubmissionListResponse {
  submissions: FormSubmission[];
  counts: SubmissionCounts;
}

export const SUBMISSION_STATUSES: readonly FormSubmissionStatus[] = [
  'new',
  'read',
  'spam',
  'archived',
];

// How many rows a page fetch pulls. Loading older rows appends via the cursor.
export const SUBMISSIONS_PAGE_SIZE = 50;

// A short, plain-language label for a status (statusLabel from @sparx/ui also
// works, but these read a touch friendlier for the inbox filter).
export const STATUS_LABEL: Record<FormSubmissionStatus, string> = {
  new: 'New',
  read: 'Read',
  spam: 'Spam',
  archived: 'Archived',
};

// The display name for a submission row/heading: the person's name, else their
// email, else a neutral fallback (never blank).
export function submissionDisplayName(s: Pick<FormSubmission, 'name' | 'email'>): string {
  const name = s.name?.trim();
  if (name) return name;
  const email = s.email?.trim();
  if (email) return email;
  return 'Someone';
}

// A one-line preview of the message for list rows.
export function messageSnippet(message: string | null, max = 120): string {
  const text = (message ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return 'No message';
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

// A compact "how long ago" label. Rendered client-side (Date.now()), so callers
// mark the element suppressHydrationWarning to avoid a first-paint mismatch.
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

// The same-origin dashboard route that streams an attachment's bytes (it proxies
// the authenticated api-rest download server-side). Addressed by index so the
// private storage key never reaches the browser.
export function attachmentDownloadHref(submissionId: string, index: number): string {
  return `/builder/forms/${submissionId}/attachments/${index}`;
}

// Human-readable file size (1 decimal for MB/KB). Used by the attachments card.
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

// The extra posted fields beyond the four we surface as first-class contact
// details — anything a form added on top of Name / Email / Phone / Message.
export function extraFields(fields: Record<string, string>): [string, string][] {
  const known = new Set(['name', 'email', 'phone', 'message']);
  return Object.entries(fields ?? {}).filter(
    ([key, value]) => !known.has(key) && typeof value === 'string' && value.trim() !== ''
  );
}
