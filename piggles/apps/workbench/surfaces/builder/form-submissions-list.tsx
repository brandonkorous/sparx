'use client';

// The submissions inbox: what people typed into the forms on your site. A table,
// because every row has the same facts and people scan DOWN a column. Form design
// lives in the visual editor; state and paging are in form-submissions-state.ts.

import { Card } from '@wizeworks/silicaui-react';
import { FormSubmissionsToolbar } from './form-submissions-toolbar';
import { PANE_SHELL } from '../../components/pane-toolbar';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import type { FormSubmission } from './form-submissions-data';
import { useFormSubmissionsList } from './form-submissions-state';
import { SubmissionsBody, SubmissionsPager, SubmissionsStaleAlert } from './form-submissions-body';

/** Same modifier contract as every other list in the app. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function FormSubmissionsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const list = useFormSubmissionsList(ctx);
  const { query, setCursors } = list;

  const resetWindow = () => {
    setCursors([]);
  };

  const open = (submission: FormSubmission, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('builder.submission', { id: submission.id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <FormSubmissionsToolbar
        statusFilter={list.statusFilter}
        onStatusFilter={(next) => {
          list.setStatusFilter(next);
          resetWindow();
        }}
        formNodeId={list.formNodeId}
        onFormNodeId={(next) => {
          list.setFormNodeId(next);
          resetWindow();
        }}
        forms={list.forms}
        isFetching={query.isFetching}
        updatedAt={query.data ? query.dataUpdatedAt : undefined}
        onRefresh={() => {
          void query.refetch();
        }}
        onOpenSettings={(target) => {
          ctx.open('builder.form-settings', undefined, { target });
        }}
      />

      <Card className="min-h-0 flex-1 overflow-y-auto">
        {list.staleAfterFailure ? <SubmissionsStaleAlert list={list} /> : null}
        <SubmissionsBody list={list} onOpen={open} />
      </Card>

      <SubmissionsPager list={list} />
    </div>
  );
}
