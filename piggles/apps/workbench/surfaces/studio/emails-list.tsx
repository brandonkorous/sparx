'use client';

// Every email this business sends, and the way into each one.
//
// A TABLE, like every other list in the app: each email carries the same facts —
// its name, the subject line it goes out with, whose it is, whether it is sending —
// and people scan DOWN one of those columns.

import { useState, type ReactNode } from 'react';
import { Button, Card, EmptyState, Input, Text } from '@wizeworks/silicaui-react';
import { faEnvelope, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Table } from '../../components/table';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneWaiting } from '../../components/pane-waiting';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { useCreateEmail, useEmails, type EmailSummary } from '../../lib/studio/email-data';
import { EmailRow } from './email-row';

const GLYPH = <Icon glyph={faEnvelope} className="size-6" aria-hidden />;

export function EmailsList({
  onOpen,
  onOpenBeside,
}: {
  onOpen: (emailId: string) => void;
  onOpenBeside: (emailId: string) => void;
}) {
  const emails = useEmails();
  const rows = emails.data ?? [];
  const retry = () => {
    void emails.refetch();
  };

  return (
    <div className={PANE_SHELL}>
      <AddEmail
        onCreated={onOpen}
        refresh={
          <RefreshButton
            isFetching={emails.isFetching}
            updatedAt={emails.data ? emails.dataUpdatedAt : undefined}
            onRefresh={retry}
          />
        }
      />

      <Card className="min-h-0 flex-1 overflow-y-auto">
        <EmailsBody
          state={emails.isError ? 'error' : emails.isPending ? 'loading' : 'ready'}
          rows={rows}
          onRetry={retry}
          onOpen={onOpen}
          onOpenBeside={onOpenBeside}
        />
      </Card>

      <Text className="hidden px-1 text-sm @lg:block">
        Click an email to open it · Shift-click to open it alongside
      </Text>
    </div>
  );
}

/** The four things this card can be: a failed load, a pending one, an empty
 *  catalogue, or the table. */
function EmailsBody({
  state,
  rows,
  onRetry,
  onOpen,
  onOpenBeside,
}: {
  state: 'error' | 'loading' | 'ready';
  rows: readonly EmailSummary[];
  onRetry: () => void;
  onOpen: (emailId: string) => void;
  onOpenBeside: (emailId: string) => void;
}) {
  if (state === 'error') {
    return (
      <PaneLoadError
        icon={GLYPH}
        title="Could not load your emails"
        description="This is a problem reaching the server. None of your designs are affected — nothing has been lost."
        onRetry={onRetry}
      />
    );
  }
  if (state === 'loading') return <PaneWaiting label="Finding your emails…" />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={GLYPH}
        title="No emails here yet"
        description="Name one above — “Spring offer”, “Thanks for booking” — and it opens straight into the editor, blank and ready to write."
      />
    );
  }
  return <EmailsTable rows={rows} onOpen={onOpen} onOpenBeside={onOpenBeside} />;
}

function EmailsTable({
  rows,
  onOpen,
  onOpenBeside,
}: {
  rows: readonly EmailSummary[];
  onOpen: (emailId: string) => void;
  onOpenBeside: (emailId: string) => void;
}) {
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Email</th>
          <th>Subject</th>
          <th className="hidden @lg:table-cell">Used by</th>
          <th>Status</th>
          <th className="w-0">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((email) => (
          <EmailRow key={email.id} email={email} onOpen={onOpen} onOpenBeside={onOpenBeside} />
        ))}
      </tbody>
    </Table>
  );
}

/** Name it and you are in it. A new email starts blank, rather than as a starter
 *  design somebody has to dismantle first. */
function AddEmail({
  onCreated,
  refresh,
}: {
  onCreated: (emailId: string) => void;
  refresh: ReactNode;
}) {
  const createEmail = useCreateEmail();
  const [name, setName] = useState('');

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const created = await createEmail.mutateAsync({ name: trimmed });
    setName('');
    onCreated(created.id);
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="max-w-md min-w-0 flex-1">
        <Input
          size="sm"
          value={name}
          placeholder="Name a new email — “Spring offer”, “Thanks for booking”"
          onChange={(event) => setName(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void add();
          }}
        />
      </div>
      <Button
        size="sm"
        color="primary"
        className="shrink-0 whitespace-nowrap"
        disabled={!name.trim() || createEmail.isPending}
        onClick={() => void add()}
      >
        <Icon glyph={faPlus} className="size-4" aria-hidden />
        Add email
      </Button>
      <div className="ml-auto shrink-0">{refresh}</div>
    </div>
  );
}
