'use client';

// The inbox's rows. Split from `form-submissions-list.tsx` under RULE #0.5: that
// file owns the toolbar, the filters, the four content states and the pager, and
// this owns what one message looks like in a list.
//
// Columns fall away on a narrow pane in the order they can be spared. SITE only
// appears when there is more than one, because on the single site most owners
// have it is their own business name written down the page — the repeat RULE #4
// says to demote, costing width that "What they sent" would rather have.

import { Badge } from '@wizeworks/silicaui-react';

import { Table } from '../../components/table';
import { formatDate, submissionState, submitterLabel } from './form-submissions-words';
import type { FormSubmission } from './form-submissions-data';

export function FormSubmissionsTable({
  rows,
  nameForm,
  siteName,
  manySites,
  previewOf,
  onOpen,
}: {
  rows: FormSubmission[];
  /** What to call each row's form — resolved from the form, not from the copy
   *  snapshotted onto the row when it was sent. */
  nameForm: (submission: FormSubmission) => string;
  /** Site id → the owner's name for it. */
  siteName: Map<string, string>;
  manySites: boolean;
  previewOf: (submission: FormSubmission) => string;
  onOpen: (submission: FormSubmission, event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  const open = onOpen;
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>From</th>
          <th className="hidden @lg:table-cell">Form</th>
          {manySites ? <th className="hidden @3xl:table-cell">Site</th> : null}
          <th className="hidden @2xl:table-cell">What they sent</th>
          <th className="hidden @xl:table-cell">Received</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((submission) => {
          const state = submissionState(submission.status);
          const site = submission.propertyId ? (siteName.get(submission.propertyId) ?? '—') : '—';
          const preview = previewOf(submission);
          const isNew = submission.status === 'new';
          return (
            <tr
              key={submission.id}
              className="cursor-pointer"
              tabIndex={0}
              role="button"
              onClick={(event) => {
                open(submission, event);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                open(submission, event);
              }}
            >
              <td>
                <span
                  className={`block max-w-56 truncate ${isNew ? 'font-semibold' : 'font-medium'}`}
                >
                  {submitterLabel(submission)}
                </span>
                {/* Only when the primary line is a NAME — otherwise the label
                      already IS the email, and repeating it is noise. */}
                {submission.name && submission.email ? (
                  <span className="block max-w-56 truncate text-sm">{submission.email}</span>
                ) : null}
              </td>
              <td className="hidden max-w-40 truncate @lg:table-cell">{nameForm(submission)}</td>
              {manySites ? (
                <td className="hidden max-w-32 truncate @3xl:table-cell">{site}</td>
              ) : null}
              <td className="hidden max-w-72 @2xl:table-cell">
                <span className="block truncate">{preview || '—'}</span>
              </td>
              <td className="hidden text-sm whitespace-nowrap @xl:table-cell">
                {formatDate(submission.createdAt)}
              </td>
              <td>
                <Badge color={state.tone} variant="soft" size="sm">
                  {state.label}
                </Badge>
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
