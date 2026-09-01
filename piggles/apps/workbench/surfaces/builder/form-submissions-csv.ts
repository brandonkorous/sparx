// One submission → a spreadsheet.
//
// Split from `form-submissions-data.ts` under RULE #0.5. A spreadsheet rather than
// JSON because the person exporting owns a business, not a codebase, and this opens
// straight into the tool they already use.

import type { FormSubmission } from './form-submissions-data';
import {
  formName,
  formatDateTime,
  humanizeKey,
  pageLabel,
  submissionState,
  submitterLabel,
} from './form-submissions-words';

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** A two-column (Field, Value) sheet of one submission — everything they sent plus
 *  where it came from — as CSV text. */
export function submissionToCsv(submission: FormSubmission, siteName: string | null): string {
  const named = formName(submission);
  const rows: [string, string][] = [
    // Named only — an "Untitled form" column in a spreadsheet is a column of nothing.
    ...(named ? ([['Form', named]] as [string, string][]) : []),
    ['Page', pageLabel(submission.pageSlug)],
    ...(siteName ? ([['Site', siteName]] as [string, string][]) : []),
    ['Submitted', formatDateTime(submission.createdAt)],
    ['Status', submissionState(submission.status).label],
  ];

  const seen = new Set<string>();
  for (const [key, value] of Object.entries(submission.fields)) {
    seen.add(key);
    rows.push([humanizeKey(key), value]);
  }
  // Promoted contact fields that a form somehow didn't echo into `fields`.
  for (const [key, value] of [
    ['name', submission.name],
    ['email', submission.email],
    ['phone', submission.phone],
    ['message', submission.message],
  ] as const) {
    if (!seen.has(key) && value && value.trim() !== '') rows.push([humanizeKey(key), value]);
  }

  const body = ['Field,Value', ...rows.map(([k, v]) => `${csvEscape(k)},${csvEscape(v)}`)].join(
    '\r\n'
  );
  // A UTF-8 BOM so spreadsheet apps read accented characters correctly.
  return `\uFEFF${body}`;
}

/** A safe, dated filename for the exported submission. */
export function submissionCsvName(submission: FormSubmission): string {
  const stamp = submission.createdAt.slice(0, 10);
  const who = submitterLabel(submission)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `submission-${stamp}${who ? `-${who}` : ''}.csv`;
}
