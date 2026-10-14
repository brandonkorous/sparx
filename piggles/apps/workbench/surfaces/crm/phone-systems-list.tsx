'use client';

// Connected phone systems (docs/144 §5.6): the account sparx places calls
// through, and the number customers see ring. This is the list only; connecting
// one is its own pane, `crm.phone-system.connect`, never a form above the table.

import type { ReactNode } from 'react';
import { Button, Card, EmptyState, Text } from '@wizeworks/silicaui-react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneEmpty } from '../../components/pane-empty';
import { PaneLoadError } from '../../components/pane-load-error';
import { faPhone, faPhoneVolume, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import {
  isModuleDisabled,
  isVoiceForbidden,
  useVoiceConnections,
  type VoiceConnection,
} from './calls-data';
import { productCopy } from '../../lib/product';
import { PhoneSystemsTable } from './phone-systems-table';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

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

const GLYPH = <Icon glyph={faPhoneVolume} className="size-6" aria-hidden />;

function countLine(count: number): string {
  if (count === 0) return 'No phone system connected yet';
  return count === 1 ? '1 phone system connected' : `${String(count)} phone systems connected`;
}

function PhoneSystemsToolbar(props: {
  count: number;
  pending: boolean;
  failed: boolean;
  locked: boolean;
  onConnect: (event: OpenEvent) => void;
  refresh: ReactNode;
}) {
  return (
    <PaneToolbar
      label="Phone systems controls"
      status={
        <>
          <Icon glyph={faPhoneVolume} className="size-4 shrink-0" aria-hidden />
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
          disabled={props.locked}
          title="Connect a phone system. Hold Shift to open alongside, Alt for a new window"
          onClick={props.onConnect}
        >
          <Icon glyph={faPlus} className="size-4" aria-hidden />
          Connect a phone system
        </Button>
      }
      refresh={props.refresh}
    />
  );
}

/** The states a rep or a new account can land on: module off, not allowed, or
 *  the server could not be reached. */
function PhoneSystemsBlocked(props: {
  moduleOff: boolean;
  forbidden: boolean;
  loadError: unknown;
  onRetry: () => void;
}) {
  if (props.moduleOff) {
    return (
      <EmptyState
        icon={GLYPH}
        title="Turn on Customers to connect a phone system"
        description="Connecting a phone system puts a Call button on every customer’s record, and writes each call onto their history without anyone having to remember to log it."
      />
    );
  }
  if (props.forbidden) {
    return (
      <EmptyState
        icon={GLYPH}
        title="Only an owner or admin can set this up"
        description="Connecting a phone system means handing over an account token, so it is kept to the people who run the account. Ask one of them to connect it: once it is done, everyone on your team gets the Call button."
      />
    );
  }
  return (
    <PaneLoadError
      icon={GLYPH}
      title="Could not load your phone systems"
      description="This is a problem reaching the server. Anything you have already connected is unaffected."
      error={props.loadError}
      onRetry={props.onRetry}
    />
  );
}

function NoPhoneSystem({ onConnect }: { onConnect: (event: OpenEvent) => void }) {
  return (
    <PaneEmpty
      module={MODULE}
      icon={GLYPH}
      title="No phone system connected yet"
      description={productCopy(
        'crm.phoneSystems.description',
        'Connect your phone account and a Call button appears on every customer’s record. Piggles rings you first, then dials them and joins the two of you, so the call is logged without anyone writing it down afterwards.'
      )}
      actions={
        <Button size="sm" color="module" onClick={onConnect}>
          Connect a phone system
        </Button>
      }
    />
  );
}

/** Only beside a row: with none listed it explained a connected number that was
 *  not there (sparx persona issue 239). */
function TokenNote({ listed }: { listed: boolean }) {
  return listed ? (
    <p className="shrink-0 px-1 text-xs">
      <Icon glyph={faPhone} className="mr-1 inline size-3" aria-hidden />
      {productCopy(
        'crm.phone.tokenNote',
        'To change the token on a connected number, disconnect it and connect it again: Piggles never shows a token back, so there is nothing to edit in place.'
      )}
    </p>
  ) : null;
}

function PhoneSystemsBody(props: {
  rows: VoiceConnection[];
  pending: boolean;
  moduleOff: boolean;
  forbidden: boolean;
  failed: boolean;
  loadError: unknown;
  onRetry: () => void;
  onConnect: (event: OpenEvent) => void;
}) {
  const { rows, moduleOff, forbidden } = props;
  const blocked = moduleOff || forbidden || props.failed;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <Card className="min-h-0 flex-1">
        {blocked ? (
          <PhoneSystemsBlocked
            moduleOff={moduleOff}
            forbidden={forbidden}
            loadError={props.loadError}
            onRetry={props.onRetry}
          />
        ) : props.pending ? (
          <PaneWaiting />
        ) : rows.length === 0 ? (
          <NoPhoneSystem onConnect={props.onConnect} />
        ) : (
          <PhoneSystemsTable rows={rows} />
        )}
      </Card>
    </div>
  );
}

export function PhoneSystemsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const query = useVoiceConnections();
  const { data, error, isPending, isError } = query;
  const rows = data?.items ?? [];
  const moduleOff = isModuleDisabled(error);
  // Only an admin may read or write these, and a rep who opens the surface
  // should be told that plainly rather than shown an empty table.
  const forbidden = isVoiceForbidden(error);
  const onConnect = (event: OpenEvent) => {
    ctx.open('crm.phone-system.connect', {}, { target: targetFor(event) });
  };
  const onRetry = () => {
    void query.refetch();
  };
  return (
    <div className={PANE_SHELL}>
      <PhoneSystemsToolbar
        count={rows.length}
        pending={isPending}
        failed={isError}
        locked={forbidden || moduleOff}
        onConnect={onConnect}
        refresh={
          <RefreshButton
            isFetching={query.isFetching}
            updatedAt={data ? query.dataUpdatedAt : undefined}
            onRefresh={onRetry}
          />
        }
      />
      <PhoneSystemsBody
        rows={rows}
        pending={isPending}
        moduleOff={moduleOff}
        forbidden={forbidden}
        failed={isError}
        loadError={error}
        onRetry={onRetry}
        onConnect={onConnect}
      />
      <TokenNote listed={rows.length > 0} />
    </div>
  );
}
