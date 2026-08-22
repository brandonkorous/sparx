'use client';

// Every web address that reaches this business.
//
// Grouped by SITE rather than shown as one flat list, because the two things a
// row has to say — "this is live" and "this is the main address" — are only true
// relative to a site. A flat list shows three rows badged "Main address" with
// nothing explaining how they differ; grouped, the card heading answers it.
//
// Deliberately NOT a table. A table wants a header row per group, so three sites
// meant three identical "Address / Status / Role" strips down the page, and the
// Role column existed to carry a badge saying "Included" beside hosts ending in
// .sparx.zone — which is precisely what a host ending in .sparx.zone already
// tells you. The address IS the content here, so each site is a card and each
// address a row inside it: host on the left, state on the right, nothing else
// competing.

import { useMemo, useState } from 'react';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneWaiting } from '../../components/pane-waiting';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Heading,
  SearchInput,
  Text,
} from '@wizeworks/silicaui-react';
import { faEarthAmericas, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useActivePropertyId } from '../../lib/api/shell-data';
import { RefreshButton } from '../../components/refresh-button';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { useSites } from '../sites/data';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { useDomains, type Domain } from './data';
import { AddressRow } from './address-row';
import { productCopy } from '../../lib/product';

/** Same modifier contract as every other list in the app. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function DomainsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const { data: domains, isPending, isError, isFetching, dataUpdatedAt, refetch } = useDomains();
  const { data: sites } = useSites();
  const activeId = useActivePropertyId();
  const [search, setSearch] = useState('');

  // A disconnected domain is kept as a row so history survives, but it is not an
  // address anyone can reach — showing it here would be listing something that
  // does not exist.
  const live = useMemo(
    () => (domains ?? []).filter((domain) => domain.status !== 'removed'),
    [domains]
  );

  const siteName = useMemo(() => {
    const map = new Map<string, string>();
    for (const site of sites ?? []) map.set(site.id, site.name);
    return map;
  }, [sites]);

  // Filtered here, not through the API: /v1/domains takes no query, the list is
  // already loaded, and it is a handful of rows. Matches the site name too, so
  // "everything under Ironleaf" is one thing to type.
  const needle = search.trim().toLowerCase();
  const matches = needle
    ? live.filter(
        (domain) =>
          domain.host.toLowerCase().includes(needle) ||
          (siteName.get(domain.propertyId) ?? '').toLowerCase().includes(needle)
      )
    : live;

  // Grouped in the SITES list's order (primary first, then by name) so the two
  // surfaces agree, rather than each sorting its own way.
  const groups = useMemo(() => {
    const byProperty = new Map<string, Domain[]>();
    for (const domain of matches) {
      const list = byProperty.get(domain.propertyId) ?? [];
      list.push(domain);
      byProperty.set(domain.propertyId, list);
    }
    return (sites ?? [])
      .map((site) => ({ site, rows: byProperty.get(site.id) ?? [] }))
      .filter((group) => group.rows.length > 0);
  }, [matches, sites]);

  const open = (domain: Domain, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('platform.settings.domain', { id: domain.id }, { target: targetFor(event) });
  };

  if (isError) {
    return (
      <Card className="min-h-0 flex-1 items-center justify-center">
        <PaneLoadError
          icon={<Icon glyph={faEarthAmericas} className="size-6" aria-hidden />}
          title="Could not load your web addresses"
          description="This is a problem reaching the server. Your addresses are unaffected and still working."
          onRetry={() => {
            void refetch();
          }}
        />
      </Card>
    );
  }

  return (
    // Surfaces, not one slab: the pane is base-200 and the toolbar is a base-100
    // card lifted onto it, matching invoicing and orders. The house pattern.
    <div className={PANE_SHELL}>
      {/* This toolbar does NOT wrap: a second line shoves the list down and
          reflows as you type. Below @xl the count gives way instead; the search
          box absorbs whatever is left (`min-w-0 flex-1`), and the primary action
          and refresh never change. */}
      <PaneToolbar
        label="Web address list controls"
        search={
          /* The width has to sit on a WRAPPER: SearchInput forwards className to
            its inner <input>, so a sizing class aimed at the control never
            reaches the element that actually lays out. */
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
        status={
          <>
            <p className="hidden shrink-0 text-sm whitespace-nowrap @xl:block">
              {needle
                ? `${String(matches.length)} of ${String(live.length)}`
                : live.length === 1
                  ? '1 address'
                  : `${String(live.length)} addresses`}
            </p>
            <div className="flex-1" />
          </>
        }
        primary={
          <Button
            color="module"
            size="sm"
            className="shrink-0 whitespace-nowrap"
            title="Connect a domain — hold Shift to open alongside, Alt for a new window"
            onClick={(event) => {
              ctx.open('platform.settings.domain', { id: 'new' }, { target: targetFor(event) });
            }}
          >
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            Connect a domain
          </Button>
        }
        views={{
          target: '/platform/settings/domains',
          params: { q: search.trim() },
          onApply: (next) => {
            setSearch(next.q ?? '');
          },
        }}
        refresh={
          /* ALWAYS the last child of a list toolbar — see RefreshButton. */
          <RefreshButton
            isFetching={isFetching}
            updatedAt={domains ? dataUpdatedAt : undefined}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isPending ? (
          <Card className="min-h-0 flex-1 items-center justify-center">
            <PaneWaiting />
          </Card>
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<Icon glyph={faEarthAmericas} className="size-6" aria-hidden />}
            title={needle ? 'No addresses match that' : 'No web addresses yet'}
            description={
              needle
                ? 'Try part of the address or the name of the site it belongs to — or clear the search to see them all.'
                : productCopy(
                    'domains.emptyUnexpected',
                    'Every site comes with a free piggles.site address, so this list should not be empty. Try reloading.'
                  )
            }
          />
        ) : (
          // Capped and centred: a pane torn onto a second monitor is otherwise
          // 2000px wide with the state badges a foot away from their addresses.
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
            {groups.map(({ site, rows }) => (
              <section key={site.id} className="card bg-base-100 overflow-hidden">
                <header className="border-base-300 flex flex-wrap items-center gap-2 border-b px-4 py-3">
                  <Heading level={2} className="text-base font-semibold">
                    {site.name}
                  </Heading>
                  {site.id === activeId ? (
                    <Badge color="success" variant="soft" size="sm">
                      You are here
                    </Badge>
                  ) : null}
                  <div className="flex-1" />
                  <Text className="text-sm">
                    {rows.length === 1 ? '1 address' : `${String(rows.length)} addresses`}
                  </Text>
                </header>
                <ul>
                  {rows.map((domain) => (
                    <AddressRow
                      key={domain.id}
                      domain={domain}
                      onOpen={(event) => {
                        open(domain, event);
                      }}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* No border now that the pane is base-200 — the hint sits ON the pane
          rather than in a docked strip, so a rule above it would be drawing a
          line under nothing. */}
      <p className="shrink-0 px-1 text-xs">
        Click an address to set it up · Shift-click to open alongside · Alt-click for a new window
      </p>
    </div>
  );
}
