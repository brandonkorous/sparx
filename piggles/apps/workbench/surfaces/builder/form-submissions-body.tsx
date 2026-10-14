'use client';

// The inbox's content card and pager: a stale-data banner, the first-load failure,
// waiting, empty and the table, then the cursor pager under it.

import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  EmptyState,
} from '@wizeworks/silicaui-react';
import { faInbox } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ListPagination } from '../../components/list-pagination';
import { RowOpenHint } from '../../components/row-open-hint';
import { loadFailureWords } from '../../lib/api-error';
import type { FormSubmission } from './form-submissions-data';
import { FormSubmissionsTable } from './form-submissions-table';
import { emptyAdvice, previewOf } from './form-submissions-filters';
import type { FormSubmissionsList } from './form-submissions-state';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

export function SubmissionsStaleAlert({ list }: { list: FormSubmissionsList }) {
  const { query } = list;
  return (
    <Alert color="warning" className="m-2">
      <AlertContent>
        <AlertTitle>Could not check for new submissions just now</AlertTitle>
        <AlertDescription>
          {loadFailureWords(
            query.error,
            'This is a problem reaching the server. What you see below is what loaded last, and may be out of date.'
          )}
        </AlertDescription>
      </AlertContent>
      <Button
        size="sm"
        color="warning"
        variant="soft"
        onClick={() => {
          void query.refetch();
        }}
      >
        Try again
      </Button>
    </Alert>
  );
}

export function SubmissionsBody({
  list,
  onOpen,
}: {
  list: FormSubmissionsList;
  onOpen: (submission: FormSubmission, event: OpenEvent) => void;
}) {
  const { query, rows, narrowed, statusFilter, activeStatus, activeFormName } = list;
  if (query.error && !list.staleAfterFailure) {
    // A failed load REPLACES the table: "nothing submitted yet" over a failure is a
    // lie about their enquiries, the worst one to tell.
    return (
      <PaneLoadError
        icon={<Icon glyph={faInbox} className="size-6" aria-hidden />}
        title="Could not load your submissions"
        description="This is a problem reaching the server. Nothing anyone sent has been lost: none of it is affected."
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  if (query.isLoading) return <PaneWaiting />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Icon glyph={faInbox} className="size-6" aria-hidden />}
        title={narrowed ? 'Nothing matches that' : 'No submissions yet'}
        description={
          narrowed
            ? emptyAdvice(statusFilter === 'all' ? null : activeStatus.label, activeFormName)
            : 'When someone fills in a form on your site (a contact request, an inquiry, a sign-up), it lands here. Add a form to a page in the editor and its submissions will show up in this inbox.'
        }
      />
    );
  }
  return (
    <FormSubmissionsTable
      rows={rows}
      nameForm={list.nameForm}
      siteName={list.siteName}
      manySites={list.manySites}
      manyForms={list.manyForms}
      previewOf={previewOf}
      onOpen={onOpen}
    />
  );
}

export function SubmissionsPager({ list }: { list: FormSubmissionsList }) {
  const { rows, cursors, setCursors, pageSize, setPageSize, query } = list;
  return (
    <div className="shrink-0">
      <ListPagination
        shown={rows.length}
        firstRow={rows.length === 0 ? 0 : cursors.length * pageSize + 1}
        page={cursors.length + 1}
        pageSize={pageSize}
        busy={query.isFetching}
        // A full window means there is (probably) another one behind it.
        hasMore={rows.length === pageSize}
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
          // meaningless: return to the newest window.
          setPageSize(size);
          setCursors([]);
        }}
      />
      {rows.length > 0 ? <RowOpenHint /> : null}
    </div>
  );
}
