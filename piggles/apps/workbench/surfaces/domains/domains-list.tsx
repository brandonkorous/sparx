'use client';

// Every web address that reaches this business, grouped by SITE: "live" and
// "main address" are only true relative to a site. Deliberately not a table: the
// address IS the content, so each site is a card and each address a row in it.

import { useState, type Dispatch, type SetStateAction } from 'react';
import { PaneLoadError } from '../../components/pane-load-error';
import { Button, Card, SearchInput } from '@wizeworks/silicaui-react';
import { faEarthAmericas, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useActivePropertyId } from '../../lib/api/shell-data';
import { RefreshButton } from '../../components/refresh-button';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { useSites } from '../sites/data';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { useDomains, type Domain } from './data';
import { RowOpenHint } from '../../components/row-open-hint';
import { DomainsListBody, useDomainGroups } from './domains-list-groups';

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

function AddressCount(props: { needle: string; matched: number; live: number }) {
  const { needle, matched, live } = props;
  return (
    <>
      <p className="hidden shrink-0 text-sm whitespace-nowrap @xl:block">
        {needle
          ? `${String(matched)} of ${String(live)}`
          : live === 1
            ? '1 address'
            : `${String(live)} addresses`}
      </p>
      <div className="flex-1" />
    </>
  );
}

function ConnectButton({ ctx }: { ctx: SurfaceContext }) {
  return (
    <Button
      color="module"
      size="sm"
      className="shrink-0 whitespace-nowrap"
      title="Connect a domain: hold Shift to open alongside, Alt for a new window"
      onClick={(event) => {
        ctx.open('platform.settings.domain', { id: 'new' }, { target: targetFor(event) });
      }}
    >
      <Icon glyph={faPlus} className="size-4" aria-hidden />
      Connect a domain
    </Button>
  );
}

function DomainsToolbar(props: {
  ctx: SurfaceContext;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  count: { needle: string; matched: number; live: number };
  query: ReturnType<typeof useDomains>;
}) {
  const { search, setSearch, query } = props;
  return (
    // Does NOT wrap: below @xl the count gives way, the search box absorbs what
    // is left, and the primary action and refresh never change.
    <PaneToolbar
      label="Domains controls"
      search={
        // The width sits on a WRAPPER: SearchInput forwards className to its
        // inner <input>, which is not the element that lays out.
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search web addresses"
            placeholder="Search addresses…"
            value={search}
            onValueChange={setSearch}
          />
        </div>
      }
      status={<AddressCount {...props.count} />}
      statusReady={!query.isPending}
      statusFailed={query.isError}
      primary={<ConnectButton ctx={props.ctx} />}
      views={{
        target: '/platform/settings/domains',
        params: { q: search.trim() },
        onApply: (next) => {
          setSearch(next.q ?? '');
        },
      }}
      refresh={
        // ALWAYS the last child of a list toolbar; see RefreshButton.
        <RefreshButton
          isFetching={query.isFetching}
          updatedAt={query.data ? query.dataUpdatedAt : undefined}
          onRefresh={() => {
            void query.refetch();
          }}
        />
      }
    />
  );
}

function DomainsLoadFailed({ query }: { query: ReturnType<typeof useDomains> }) {
  return (
    <Card className="min-h-0 flex-1 items-center justify-center">
      <PaneLoadError
        icon={<Icon glyph={faEarthAmericas} className="size-6" aria-hidden />}
        title="Could not load your web addresses"
        description="This is a problem reaching the server. Your addresses are unaffected and still working."
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    </Card>
  );
}

export function DomainsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const query = useDomains();
  const { data: sites } = useSites();
  const activeId = useActivePropertyId();
  const [search, setSearch] = useState('');
  const { live, needle, matches, groups } = useDomainGroups(query.data, sites, search);

  const open = (domain: Domain, event: OpenEvent) => {
    ctx.open('platform.settings.domain', { id: domain.id }, { target: targetFor(event) });
  };

  if (query.isError) return <DomainsLoadFailed query={query} />;

  return (
    // The pane is base-200 and the toolbar a base-100 card lifted onto it.
    <div className={PANE_SHELL}>
      <DomainsToolbar
        ctx={ctx}
        search={search}
        setSearch={setSearch}
        count={{ needle, matched: matches.length, live: live.length }}
        query={query}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <DomainsListBody
          pending={query.isPending}
          needle={needle}
          groups={groups}
          activeId={activeId}
          onOpen={open}
        />
      </div>

      {/* No border: the hint sits ON the base-200 pane, so a rule above it
          would be drawing a line under nothing. */}
      {groups.length > 0 ? <RowOpenHint what="an address to set it up" /> : null}
    </div>
  );
}
