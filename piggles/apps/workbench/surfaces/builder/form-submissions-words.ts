// What things in the submissions inbox are CALLED, and how values are written out.
//
// Split from `form-submissions-data.ts` under RULE #0.5: that module talks to the
// server, and this one decides the words. Nothing here fetches anything, so the
// list, the detail and the CSV export can all say a thing the same way.

import { apiErrorMessage } from '../../lib/api-error';
import type { FormSubmission, SubmissionFormRef } from './form-submissions-data';

export type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/** What a submission's status means, in an operator's words, with the tone that
 *  carries the state's color on a `<Badge>`. */
export function submissionState(status: string): { label: string; tone: Tone; detail: string } {
  switch (status) {
    case 'new':
      return {
        label: 'New',
        tone: 'info',
        detail: 'Nobody has dealt with this yet.',
      };
    case 'read':
      return {
        label: 'Read',
        tone: 'neutral',
        detail: 'This has been opened, but not yet marked as handled.',
      };
    case 'archived':
      return {
        label: 'Handled',
        tone: 'success',
        detail:
          'This has been dealt with and filed away. You can move it back to your inbox at any time.',
      };
    case 'spam':
      return {
        label: 'Spam',
        tone: 'warning',
        detail: 'This was flagged as junk. It stays here so nothing is silently lost.',
      };
    default:
      return { label: status || 'Unknown', tone: 'neutral', detail: '' };
  }
}

/** A human name for a submission, for the list, the tab and the detail heading.
 *  Prefers who sent it, then how to reach them, then a clear placeholder — never
 *  a blank row. */
export function submitterLabel(
  submission: Pick<FormSubmission, 'name' | 'email' | 'phone'>
): string {
  if (submission.name && submission.name.trim() !== '') return submission.name.trim();
  if (submission.email && submission.email.trim() !== '') return submission.email.trim();
  if (submission.phone && submission.phone.trim() !== '') return submission.phone.trim();
  return 'Anonymous';
}

/** What the form is CALLED, in the owner's own words, or null when it has no name.
 *  Length-checked rather than truthiness-checked: an empty string after trimming is
 *  "no name", and `?? null` would keep it and render a blank cell. */
export function formName(submission: Pick<FormSubmission, 'formName'>): string | null {
  const name = submission.formName?.trim() ?? '';
  return name.length > 0 ? name : null;
}

/** Where on the site it was submitted from, in plain words. */
export function pageLabel(pageSlug: string | null): string {
  return pageSlug && pageSlug.trim() !== '' ? `/${pageSlug}` : 'Home page';
}

/**
 * How to IDENTIFY the form in a column that has one line to do it — its name if it has
 * one, otherwise the page it sits on.
 *
 * This used to return a bare "Untitled form", which is what every row on every site
 * said: the name had no console surface, so it was never set, and the column that
 * exists to tell three forms apart told an owner nothing (issue 353). The page was
 * already on the row and already rendered one line lower in the detail view.
 *
 * Two forms on the SAME page still collide. That wants a per-form disambiguator and
 * is recorded in the issue rather than papered over with a node id no one can read.
 */
export function formLabel(submission: Pick<FormSubmission, 'formName' | 'pageSlug'>): string {
  return formName(submission) ?? pageLabel(submission.pageSlug);
}

/**
 * Name every row by its FORM, not by the copy frozen onto that row.
 *
 * `formName` on a submission is a snapshot taken the moment somebody pressed send,
 * which is the right thing for a stored row to hold and the wrong thing to put in a
 * column. An owner who names her contact form after two people have already used it
 * gets an inbox listing the same form twice — two rows under the name she chose and
 * two under `/contact`, which is not a name at all but the address of a page
 * (issue 372).
 *
 * The response's `forms` list carries each form's CURRENT name, so reading the label
 * from there makes the column and the "which form" picker agree by construction
 * rather than by both happening to be right.
 */
export function formNamer(
  forms: SubmissionFormRef[]
): (submission: Pick<FormSubmission, 'formNodeId' | 'formName' | 'pageSlug'>) => string {
  const byNode = new Map(forms.map((form) => [form.formNodeId, formLabel(form)]));
  // The row's own snapshot is the fallback, for a form that has since been deleted
  // from the page and so is not in `forms` at all.
  return (submission) => byNode.get(submission.formNodeId) ?? formLabel(submission);
}

/**
 * The server's own sentence for a 4xx, shown verbatim — the forms routes explain
 * the real problem ("Invalid status.") better than a status code can. A 5xx
 * carries no such sentence, so it falls back to the caller's wording.
 */
export function submissionErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}

/* ── Formatting ─────────────────────────────────────────────────────────── */

/** Medium date, or an em dash for nothing. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

/** Date and time together — for the moment a submission arrived. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** A byte count in the units a person reads. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 bytes';
  const units = ['bytes', 'KB', 'MB', 'GB'];
  const power = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  if (power === 0) return `${String(bytes)} bytes`;
  const value = bytes / 1024 ** power;
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[power]}`;
}

/** Turn a field key ("full_name", "phoneNumber") into a readable label. */
export function humanizeKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  if (spaced === '') return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
