// What the inbox can be narrowed to, and the two sentences that describe the
// result. Split from `form-submissions-list.tsx` under RULE #0.5.
//
// Here rather than in `form-submissions-data.ts`: that module is the server's
// shapes and the queries over them, and these are the screen's own vocabulary.

import type { FormSubmission, SubmissionStatus } from './form-submissions-data';

/** The chips ARE the questions people open this inbox to answer. */
export const STATUS_FILTERS = [
  { value: 'all', label: 'All', status: undefined },
  { value: 'new', label: 'New', status: 'new' },
  { value: 'read', label: 'Read', status: 'read' },
  { value: 'archived', label: 'Handled', status: 'archived' },
  { value: 'spam', label: 'Spam', status: 'spam' },
] as const satisfies readonly {
  value: string;
  label: string;
  status: SubmissionStatus | undefined;
}[];

export type StatusFilterValue = (typeof STATUS_FILTERS)[number]['value'];

/**
 * `status` on the address, read once as the chip's starting value.
 *
 * Home's "2 people wrote to you from your website" has always SENT `status:
 * 'new'`, and nothing here read it: the inbox opened on All, with the two
 * somewhere among every message the site had ever had, under a sentence whose
 * own comment said it opened on New ([258]). Anything unrecognised means "no
 * narrowing", never a guess.
 */
export function parseStatusFilter(raw: unknown): StatusFilterValue {
  return STATUS_FILTERS.find((entry) => entry.value === raw)?.value ?? 'all';
}

/** A one-line preview of what they actually wrote, for the table. */
export function previewOf(submission: FormSubmission): string {
  if (submission.message && submission.message.trim() !== '') return submission.message.trim();
  for (const value of Object.values(submission.fields)) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return '';
}

export function emptyAdvice(statusLabel: string | null, formName: string | null): string {
  const parts: string[] = [];
  if (statusLabel) {
    parts.push(`You are only seeing “${statusLabel}”. Switch to All to see the rest.`);
  }
  if (formName) {
    parts.push(`Only submissions from “${formName}” are showing. Choose All forms to widen it.`);
  }
  return parts.join(' ');
}
