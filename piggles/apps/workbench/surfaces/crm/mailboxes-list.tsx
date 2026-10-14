'use client';

// Connected mailboxes (docs/144 §5.2): the email accounts sparx reads from and
// sends through. This is the list only; connecting one is its own pane,
// `crm.mailbox.connect`, never a form parked above the table.

import type { ReactNode } from 'react';
import { Button, Card, EmptyState, Text } from '@wizeworks/silicaui-react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneEmpty } from '../../components/pane-empty';
import { PaneLoadError } from '../../components/pane-load-error';
import { faMailbox, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { isModuleDisabled, useMailboxes, type Mailbox } from './mailboxes-data';
import { productCopy } from '../../lib/product';
import { MailboxesTable } from './mailboxes-table';
import { useMailboxMoves } from './use-mailbox-moves';

/** Shift opens alongside, Alt pops out — the same modifier contract every other
 *  list in the workbench honours. */
function targetFor(event: OpenEvent): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** Registry module for this pane, so the brand draws Customers' own picture
 *  rather than the generic one. */
const MODULE = 'crm';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

function countLine(count: number): string {
  if (count === 0) return 'No mailbox connected yet';
  return count === 1 ? '1 mailbox connected' : `${String(count)} mailboxes connected`;
}

function MailboxesToolbar(props: {
  count: number;
  pending: boolean;
  failed: boolean;
  onConnect: (event: OpenEvent) => void;
  refresh: ReactNode;
}) {
  return (
    <PaneToolbar
      label="Mailboxes controls"
      status={
        <>
          <Icon glyph={faMailbox} className="size-4 shrink-0" aria-hidden />
          <Text as="span" className="text-sm">
            {countLine(props.count)}
          </Text>
        </>
      }
      statusReady={!props.pending}
      statusFailed={props.failed}
      primary={
        <Button
          color="module"
          size="sm"
          title="Connect a mailbox: hold Shift to open alongside, Alt for a new window"
          onClick={props.onConnect}
        >
          <Icon glyph={faPlus} className="size-4" aria-hidden />
          Connect a mailbox
        </Button>
      }
      refresh={props.refresh}
    />
  );
}

/** Every state but the list itself: module off, failed, loading, none yet. */
function MailboxesState(props: {
  moduleOff: boolean;
  failed: boolean;
  loadError: unknown;
  onRetry: () => void;
  onConnect: (event: OpenEvent) => void;
}) {
  if (props.moduleOff) {
    return (
      <EmptyState
        icon={<Icon glyph={faMailbox} className="size-6" aria-hidden />}
        title="Turn on Customers to connect a mailbox"
        description="Connecting a mailbox puts the emails you exchange with a customer onto their record, so the conversation sits with everything else you know about them rather than buried in an inbox."
      />
    );
  }
  if (props.failed) {
    return (
      <PaneLoadError
        icon={<Icon glyph={faMailbox} className="size-6" aria-hidden />}
        title="Could not load your mailboxes"
        description="This is a problem reaching the server. Anything you have already connected is unaffected."
        error={props.loadError}
        onRetry={props.onRetry}
      />
    );
  }
  return (
    <PaneEmpty
      module={MODULE}
      icon={<Icon glyph={faMailbox} className="size-6" aria-hidden />}
      title="No mailbox connected yet"
      description="Connect the email account you write to customers from. Their replies land on their record, so the whole conversation is in one place the next time you open them."
      actions={
        <Button size="sm" color="module" onClick={props.onConnect}>
          Connect a mailbox
        </Button>
      }
    />
  );
}

function MailboxesBody(props: {
  rows: Mailbox[];
  pending: boolean;
  moduleOff: boolean;
  failed: boolean;
  loadError: unknown;
  onRetry: () => void;
  onConnect: (event: OpenEvent) => void;
}) {
  const moves = useMailboxMoves();
  const { rows } = props;
  const listed = !props.moduleOff && !props.failed && !props.pending && rows.length > 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <Card className="min-h-0 flex-1">
        {listed ? (
          <MailboxesTable rows={rows} moves={moves} />
        ) : props.pending && !props.moduleOff && !props.failed ? (
          <PaneWaiting />
        ) : (
          <MailboxesState {...props} />
        )}
      </Card>
    </div>
  );
}

/** Only beside a row: with none listed it pointed at a button that was not there
 *  (sparx persona issue 236). */
function CheckNote({ listed }: { listed: boolean }) {
  return listed ? (
    <p className="shrink-0 px-1 text-xs">
      {/* The whole sentence lives in the key: an override replaces a whole
          sentence, so a tail glued on here ended up after it. */}
      {productCopy(
        'crm.mailbox.checkNote',
        'Piggles checks connected mailboxes every few minutes. Use the refresh button on a row to check one right now.'
      )}
    </p>
  ) : null;
}

export function MailboxesListSurface({ ctx }: { ctx: SurfaceContext }) {
  const { data, error, isPending, isError, isFetching, dataUpdatedAt, refetch } = useMailboxes();
  const rows = data?.items ?? [];
  const moduleOff = isModuleDisabled(error);
  const onConnect = (event: OpenEvent) => {
    ctx.open('crm.mailbox.connect', {}, { target: targetFor(event) });
  };
  const onRetry = () => {
    void refetch();
  };
  return (
    <div className={PANE_SHELL}>
      <MailboxesToolbar
        count={rows.length}
        pending={isPending}
        failed={isError}
        onConnect={onConnect}
        refresh={
          <RefreshButton
            isFetching={isFetching}
            updatedAt={data ? dataUpdatedAt : undefined}
            onRefresh={onRetry}
          />
        }
      />
      <MailboxesBody
        rows={rows}
        pending={isPending}
        moduleOff={moduleOff}
        failed={isError}
        loadError={error}
        onRetry={onRetry}
        onConnect={onConnect}
      />
      <CheckNote listed={rows.length > 0} />
    </div>
  );
}
