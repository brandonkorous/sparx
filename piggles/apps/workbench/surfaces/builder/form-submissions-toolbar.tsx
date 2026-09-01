'use client';

// The inbox's controls. Split from `form-submissions-list.tsx` under RULE #0.5:
// that file owns the four content states and the pager, and this owns what can be
// narrowed, saved, and opened from here.
//
// Every narrowing goes back to the newest window, because a stored cursor is a
// boundary in the OLD result set and means nothing in the new one. The list owns
// that reset; this only reports the change.

import { Filter, FilterItem, NativeSelect } from '@wizeworks/silicaui-react';
import { faSliders } from '@fortawesome/pro-solid-svg-icons';

import { PaneToolbar } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget } from '../../lib/surfaces/registry';
import { type SubmissionFormRef } from './form-submissions-data';
import { formLabel } from './form-submissions-words';
import { STATUS_FILTERS, type StatusFilterValue } from './form-submissions-filters';

/** Same modifier contract as every other list in the app. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function FormSubmissionsToolbar({
  statusFilter,
  onStatusFilter,
  formNodeId,
  onFormNodeId,
  forms,
  isFetching,
  updatedAt,
  onRefresh,
  onOpenSettings,
}: {
  statusFilter: StatusFilterValue;
  onStatusFilter: (next: StatusFilterValue) => void;
  formNodeId: string;
  onFormNodeId: (next: string) => void;
  forms: SubmissionFormRef[];
  isFetching: boolean;
  /** Undefined until the first load lands, so "updated just now" is never a guess. */
  updatedAt: number | undefined;
  onRefresh: () => void;
  onOpenSettings: (target: OpenTarget) => void;
}) {
  return (
    <PaneToolbar
      label="Submissions inbox controls"
      controls={
        <>
          <Filter
            color="module"
            value={statusFilter}
            onValueChange={(next) => {
              onStatusFilter((next as StatusFilterValue | null) ?? 'all');
            }}
            showReset={false}
            aria-label="Filter by status"
          >
            {STATUS_FILTERS.map((entry) => (
              <FilterItem key={entry.value} value={entry.value}>
                {entry.label}
              </FilterItem>
            ))}
          </Filter>
          {/* Only worth showing once more than one form has ever been submitted —
          with a single form the picker chooses nothing. */}
          {forms.length > 1 ? (
            <label className="items-center">
              <span className="sr-only">Which form</span>
              <NativeSelect
                size="sm"
                color="module"
                value={formNodeId}
                aria-label="Which form"
                onChange={(event) => {
                  onFormNodeId(event.target.value);
                }}
              >
                <option value="">All forms</option>
                {forms.map((form) => (
                  <option key={form.formNodeId} value={form.formNodeId}>
                    {formLabel(form) + ` (${String(form.count)})`}
                  </option>
                ))}
              </NativeSelect>
            </label>
          ) : null}
        </>
      }
      // Settings, not a commit action, so `actions` rather than `primary`.
      // This inbox is where an owner notices that a form has no name and that
      // nobody was emailed, so it is where the way to change that belongs.
      actions={[
        {
          label: 'Form settings',
          icon: faSliders,
          title: 'Name a form, choose who is emailed, and reply automatically',
          onClick: (event) => {
            onOpenSettings(targetFor(event));
          },
        },
      ]}
      views={{
        target: '/builder/forms',
        params: { status: statusFilter, form: formNodeId },
        onApply: (next) => {
          onStatusFilter((next.status ?? 'all') as StatusFilterValue);
          onFormNodeId(next.form ?? '');
        },
      }}
      refresh={
        <RefreshButton isFetching={isFetching} updatedAt={updatedAt} onRefresh={onRefresh} />
      }
    />
  );
}
