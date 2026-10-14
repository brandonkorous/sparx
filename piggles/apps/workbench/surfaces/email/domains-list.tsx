'use client';

// Every address your email can be sent FROM: a domain you own and have proven
// to the email provider, so mail goes out as hello@yourbusiness.com and reaches
// inboxes instead of spam folders.

import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { PaneLoadError } from '../../components/pane-load-error';
import { Button, Card, SearchInput } from '@wizeworks/silicaui-react';
import { faEnvelopeCircleCheck, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { RefreshButton } from '../../components/refresh-button';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { ManagersOnlyNotice } from '../../components/managers-only';
import { useManageRights } from '../../lib/manage-rights';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { useEmailSettings, useSendingDomains, type SendingDomain } from './domains-data';
import { RowOpenHint } from '../../components/row-open-hint';
import { SendingDomainsBody } from './domains-list-body';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

/** Same modifier contract as every other list in the app. */
function targetFor(event: OpenEvent): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function AddressCount(props: { needle: string; matched: number; all: number }) {
  const { needle, matched, all } = props;
  return (
    <p className="hidden shrink-0 text-sm whitespace-nowrap @xl:block">
      {needle
        ? `${String(matched)} of ${String(all)}`
        : all === 1
          ? '1 address'
          : `${String(all)} addresses`}
    </p>
  );
}

function AddButton({ onAdd }: { onAdd: (event: OpenEvent) => void }) {
  return (
    <Button
      color="module"
      size="sm"
      className="ml-auto shrink-0 whitespace-nowrap"
      title="Add a sending address. Hold Shift to open alongside, Alt for a new window"
      onClick={onAdd}
    >
      <Icon glyph={faPlus} className="size-4" aria-hidden />
      Add a sending address
    </Button>
  );
}

function SendingDomainsToolbar(props: {
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  count: { needle: string; matched: number; all: number };
  locked: boolean;
  onAdd: (event: OpenEvent) => void;
  query: ReturnType<typeof useSendingDomains>;
}) {
  const { search, setSearch, query } = props;
  return (
    <PaneToolbar
      label="Sending addresses controls"
      search={
        // The width sits on a WRAPPER: SearchInput forwards className to its
        // inner <input>, which is not the element that lays out.
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search sending addresses"
            placeholder="Search addresses…"
            value={search}
            onValueChange={setSearch}
          />
        </div>
      }
      status={<AddressCount {...props.count} />}
      statusReady={!query.isPending}
      statusFailed={query.isError}
      primary={props.locked ? undefined : <AddButton onAdd={props.onAdd} />}
      views={{
        target: '/email/domains',
        params: { q: search.trim() },
        onApply: (next) => {
          setSearch(next.q ?? '');
        },
      }}
      refresh={<ToolbarRefresh query={query} />}
    />
  );
}

/** ALWAYS the last child of a list toolbar; see RefreshButton. */
function ToolbarRefresh({ query }: { query: ReturnType<typeof useSendingDomains> }) {
  return (
    <RefreshButton
      isFetching={query.isFetching}
      updatedAt={query.data ? query.dataUpdatedAt : undefined}
      onRefresh={() => {
        void query.refetch();
      }}
    />
  );
}

function SendingDomainsLoadFailed({ query }: { query: ReturnType<typeof useSendingDomains> }) {
  return (
    <Card className="min-h-0 flex-1 items-center justify-center">
      <PaneLoadError
        icon={<Icon glyph={faEnvelopeCircleCheck} className="size-6" aria-hidden />}
        title="Could not load your sending addresses"
        description="This is a problem reaching the server. Your addresses are unaffected. Nothing has been lost."
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    </Card>
  );
}

/** The addresses, the ones the search matches, and this site's default. */
function useSendingDomainsPane() {
  const query = useSendingDomains();
  const { data: settings } = useEmailSettings();
  const [search, setSearch] = useState('');
  const rights = useManageRights();
  const locked = rights.known && !rights.canManage;

  const all = useMemo(() => query.data ?? [], [query.data]);
  const defaultId = settings?.defaultSendingDomainId ?? null;

  const needle = search.trim().toLowerCase();
  const matches = useMemo(
    () => (needle ? all.filter((domain) => domain.domain.toLowerCase().includes(needle)) : all),
    [all, needle]
  );
  return { query, search, setSearch, locked, all, defaultId, needle, matches };
}

export function SendingDomainsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const { query, search, setSearch, locked, all, defaultId, needle, matches } =
    useSendingDomainsPane();

  const open = (domain: SendingDomain, event: OpenEvent) => {
    ctx.open('email.domains.detail', { id: domain.id }, { target: targetFor(event) });
  };
  const onAdd = (event: OpenEvent) => {
    ctx.open('email.domains.detail', { id: 'new' }, { target: targetFor(event) });
  };

  if (query.isError) return <SendingDomainsLoadFailed query={query} />;

  return (
    <div className={PANE_SHELL}>
      <SendingDomainsToolbar
        search={search}
        setSearch={setSearch}
        count={{ needle, matched: matches.length, all: all.length }}
        locked={locked}
        onAdd={onAdd}
        query={query}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Only an owner or an admin adds or changes these (sparx persona
            issue 168); each address still opens for anybody to read. */}
        <ManagersOnlyNotice change="add, check or remove sending addresses" className="px-4 pt-4" />
        <SendingDomainsBody
          pending={query.isPending}
          needle={needle}
          locked={locked}
          all={all}
          matches={matches}
          defaultId={defaultId}
          onOpen={open}
          onAdd={onAdd}
        />
      </div>

      {matches.length > 0 ? <RowOpenHint what="an address to set it up" /> : null}
    </div>
  );
}
