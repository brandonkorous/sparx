'use client';

// The inbox's rows. Split from `form-submissions-list.tsx` under RULE #0.5: that
// file owns the toolbar, the filters, the four content states and the pager, and
// this owns what one message looks like in a list.
//
// Columns fall away on a narrow pane in the order they can be spared, and WHAT
// SHE WAS SENT is the last thing to go, because it is the only column that says
// what the message is about.
//
// It used to go first but one. The order was From, FORM, Site, what they sent,
// received — so between 32rem and 42rem an owner read a name, a Read/New chip,
// and which form it arrived through, and nothing at all about the message or
// when it came. On the pane width the dock actually opens this at, she read a
// name and a chip (issue 858).
//
// FORM and SITE are both demoted to "only when there is more than one". Every
// tenant on the platform with an inbox has exactly ONE form, so that column was
// the same string written down the page, which is the repeat RULE #4 says to
// demote — the same argument the Site column already had, applied to its
// neighbour. [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// And below the width where the column fits at all, the preview rides in the
// FROM cell as a third line rather than vanishing. That cell already stacks a
// name over an email; a message under them is the same idea, and it means there
// is no width at which this screen shows a list of messages with none of the
// message.

import { Badge } from '@wizeworks/silicaui-react';

import { Table } from '../../components/table';
import { formatDate, submissionState, submitterLabel } from './form-submissions-words';
import type { FormSubmission } from './form-submissions-data';

export function FormSubmissionsTable({
  rows,
  nameForm,
  siteName,
  manySites,
  manyForms,
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
  /** Whether more than one form feeds this inbox. With one, naming it on every
   *  row is the same word repeated down the page. */
  manyForms: boolean;
  previewOf: (submission: FormSubmission) => string;
  onOpen: (submission: FormSubmission, event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  const open = onOpen;
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>From</th>
          <th className="hidden @lg:table-cell">What they sent</th>
          <th className="hidden @xl:table-cell">Received</th>
          {manyForms ? <th className="hidden @2xl:table-cell">Form</th> : null}
          {manySites ? <th className="hidden @3xl:table-cell">Site</th> : null}
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
                {/* Below the width where the column fits, the message rides
                      here rather than disappearing. Hidden exactly where the
                      column takes over, so it is never said twice. */}
                {preview ? (
                  <span className="block max-w-56 truncate text-sm @lg:hidden">{preview}</span>
                ) : null}
              </td>
              <td className="hidden max-w-72 @lg:table-cell">
                <span className="block truncate">{preview || '—'}</span>
              </td>
              <td className="hidden text-sm whitespace-nowrap @xl:table-cell">
                {formatDate(submission.createdAt)}
              </td>
              {manyForms ? (
                <td className="hidden max-w-40 truncate @2xl:table-cell">{nameForm(submission)}</td>
              ) : null}
              {manySites ? (
                <td className="hidden max-w-32 truncate @3xl:table-cell">{site}</td>
              ) : null}
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
