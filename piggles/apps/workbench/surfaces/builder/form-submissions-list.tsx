'use client';

// The submissions inbox — what people typed into the forms on your site.
//
// A table, because submissions are genuinely tabular: every row has the same
// facts (who sent it, which form, when, whether it's been dealt with) and people
// scan DOWN a column — "what's still New", "what came through the contact form".
// This is the INBOX, not the form designer; form design lives in the visual
// editor.
//
// The inbox is TENANT-WIDE (across every site), so a row names the site it came
// from. Paging is a keyset CURSOR, not offset: new submissions arrive at the top
// while an operator reads, and offset paging would re-show rows already passed
// (see form-submissions-data.ts, and the activity feed for the same reasoning).

import { useMemo, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  EmptyState,
} from '@wizeworks/silicaui-react';
import { FormSubmissionsTable } from './form-submissions-table';
import { FormSubmissionsToolbar } from './form-submissions-toolbar';
import { faInbox } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ListPagination, type PageSize } from '../../components/list-pagination';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { useSites } from '../../lib/api/shell-data';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { useSubmissions, type FormSubmission } from './form-submissions-data';
import { formLabel, formNamer } from './form-submissions-words';
import {
  emptyAdvice,
  previewOf,
  STATUS_FILTERS,
  type StatusFilterValue,
} from './form-submissions-filters';
import { RowOpenHint } from '../../components/row-open-hint';

/** Same modifier contract as every other list in the app. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function FormSubmissionsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');
  const [formNodeId, setFormNodeId] = useState('');
  const [pageSize, setPageSize] = useState<PageSize>(50);
  // One cursor per step back through the inbox. Empty = the newest window.
  // A stack, so "Newer" is a pop — stepping back needs the boundary of the
  // previous window, which only the stack remembers.
  const [cursors, setCursors] = useState<string[]>([]);

  const activeStatus =
    STATUS_FILTERS.find((entry) => entry.value === statusFilter) ?? STATUS_FILTERS[0];
  const cursor = cursors[cursors.length - 1];

  const { data, isLoading, isFetching, dataUpdatedAt, error, refetch } = useSubmissions({
    ...(activeStatus.status ? { status: activeStatus.status } : {}),
    ...(formNodeId ? { formNodeId } : {}),
    ...(cursor ? { cursor } : {}),
    limit: pageSize,
  });

  const { data: sites } = useSites();
  const siteName = useMemo(() => {
    const map = new Map<string, string>();
    for (const site of sites ?? []) map.set(site.id, site.name);
    return map;
  }, [sites]);
  // Which site a message came from only tells her something when she has more
  // than one. On the single site most owners have, the column is her own business
  // name written down the page — the repeat RULE #4 says to demote, costing a
  // column that "What they sent" would rather have. The same test the staff panes
  // already use for their site picker.
  const manySites = (sites?.length ?? 0) > 1;

  const rows = data?.submissions ?? [];
  const forms = data?.forms ?? [];
  // A full window means there is (probably) another one behind it — the same
  // "the window came back full" signal the activity feed walks on.
  const hasMore = rows.length === pageSize;
  const firstRow = cursors.length * pageSize + 1;
  const narrowed = statusFilter !== 'all' || formNodeId !== '';
  const staleAfterFailure = Boolean(error) && rows.length > 0;

  const resetWindow = () => {
    setCursors([]);
  };

  const open = (submission: FormSubmission, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('builder.submission', { id: submission.id }, { target: targetFor(event) });
  };

  // Rows are named from `forms`, which carries each form's CURRENT name, so the
  // column and the picker cannot disagree (issue 372).
  const nameForm = formNamer(forms);

  const activeFormName = formNodeId
    ? (() => {
        const picked = forms.find((form) => form.formNodeId === formNodeId);
        return picked ? formLabel(picked) : 'this form';
      })()
    : null;

  return (
    <div className={PANE_SHELL}>
      <FormSubmissionsToolbar
        statusFilter={statusFilter}
        onStatusFilter={(next) => {
          setStatusFilter(next);
          resetWindow();
        }}
        formNodeId={formNodeId}
        onFormNodeId={(next) => {
          setFormNodeId(next);
          resetWindow();
        }}
        forms={forms}
        isFetching={isFetching}
        updatedAt={data ? dataUpdatedAt : undefined}
        onRefresh={() => {
          void refetch();
        }}
        onOpenSettings={(target) => {
          ctx.open('builder.form-settings', undefined, { target });
        }}
      />

      <Card className="min-h-0 flex-1 overflow-y-auto">
        {staleAfterFailure ? (
          <Alert color="warning" className="m-2">
            <AlertContent>
              <AlertTitle>Could not check for new submissions just now</AlertTitle>
              <AlertDescription>
                This is a problem reaching the server. What you see below is what loaded last, and
                may be out of date.
              </AlertDescription>
            </AlertContent>
            <Button
              size="sm"
              color="warning"
              variant="soft"
              onClick={() => {
                void refetch();
              }}
            >
              Try again
            </Button>
          </Alert>
        ) : null}

        {error && !staleAfterFailure ? (
          // A failed load REPLACES the table — "nothing submitted yet" over a
          // connection failure is a lie about their enquiries, the worst one to tell.
          <PaneLoadError
            icon={<Icon glyph={faInbox} className="size-6" aria-hidden />}
            title="Could not load your submissions"
            description="This is a problem reaching the server. Nothing anyone sent has been lost — none of it is affected."
            onRetry={() => {
              void refetch();
            }}
          />
        ) : isLoading ? (
          <PaneWaiting />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Icon glyph={faInbox} className="size-6" aria-hidden />}
            title={narrowed ? 'Nothing matches that' : 'No submissions yet'}
            description={
              narrowed
                ? emptyAdvice(statusFilter === 'all' ? null : activeStatus.label, activeFormName)
                : 'When someone fills in a form on your site — a contact request, an enquiry, a sign-up — it lands here. Add a form to a page in the editor and its submissions will show up in this inbox.'
            }
          />
        ) : (
          <FormSubmissionsTable
            rows={rows}
            nameForm={nameForm}
            siteName={siteName}
            manySites={manySites}
            previewOf={previewOf}
            onOpen={open}
          />
        )}
      </Card>

      <div className="shrink-0">
        <ListPagination
          shown={rows.length}
          firstRow={rows.length === 0 ? 0 : firstRow}
          page={cursors.length + 1}
          pageSize={pageSize}
          busy={isFetching}
          hasMore={hasMore}
          onOlder={() => {
            const last = rows[rows.length - 1];
            if (last) setCursors((current) => [...current, last.id]);
          }}
          {...(cursors.length > 0
            ? {
                onNewer: () => {
                  setCursors((current) => current.slice(0, -1));
                },
              }
            : {})}
          onPageSizeChange={(size) => {
            // Window boundaries move with the size, so every stored cursor is
            // meaningless — return to the newest window rather than resuming at a
            // boundary that no longer lines up with anything.
            setPageSize(size);
            setCursors([]);
          }}
        />
        <RowOpenHint />
      </div>
    </div>
  );
}
