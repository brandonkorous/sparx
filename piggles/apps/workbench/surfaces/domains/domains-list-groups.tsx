'use client';

// The body of the web addresses list: the addresses grouped by site, one card
// per site with each address a row inside it, plus the waiting and empty states.

import { useMemo } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { Badge, Card, EmptyState, Heading, Text } from '@wizeworks/silicaui-react';
import { faEarthAmericas } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { Site } from '../sites/data';
import type { Domain } from './data';
import { AddressRow } from './address-row';
import { productCopy } from '../../lib/product';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}
export interface DomainGroup {
  site: Site;
  rows: Domain[];
}

/** The live addresses, the ones the search matches, and those grouped by site. */
export function useDomainGroups(
  domains: Domain[] | undefined,
  sites: Site[] | undefined,
  search: string
) {
  // A disconnected domain is kept as a row so history survives, but it is not an
  // address anyone can reach, so it is not listed.
  const live = useMemo(
    () => (domains ?? []).filter((domain) => domain.status !== 'removed'),
    [domains]
  );

  const siteName = useMemo(() => {
    const map = new Map<string, string>();
    for (const site of sites ?? []) map.set(site.id, site.name);
    return map;
  }, [sites]);

  // Filtered here, not through the API: /v1/domains takes no query and it is a
  // handful of rows. Matches the site name too.
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

  return { live, needle, matches, groups };
}

function SiteAddressCard(props: {
  group: DomainGroup;
  activeId: string | null;
  onOpen: (domain: Domain, event: OpenEvent) => void;
}) {
  const { site, rows } = props.group;
  return (
    <section className="card bg-base-100 overflow-hidden">
      <header className="border-base-300 flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <Heading level={2} className="text-base font-semibold">
          {site.name}
        </Heading>
        {site.id === props.activeId ? (
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
              props.onOpen(domain, event);
            }}
          />
        ))}
      </ul>
    </section>
  );
}

export function DomainsListBody(props: {
  pending: boolean;
  needle: string;
  groups: DomainGroup[];
  activeId: string | null;
  onOpen: (domain: Domain, event: OpenEvent) => void;
}) {
  const { needle, groups } = props;
  if (props.pending) {
    return (
      <Card className="min-h-0 flex-1 items-center justify-center">
        <PaneWaiting />
      </Card>
    );
  }
  if (groups.length === 0) {
    return (
      <EmptyState
        icon={<Icon glyph={faEarthAmericas} className="size-6" aria-hidden />}
        title={needle ? 'No addresses match that' : 'No web addresses yet'}
        description={
          needle
            ? 'Try part of the address or the name of the site it belongs to, or clear the search to see them all.'
            : productCopy(
                'domains.emptyUnexpected',
                'Every site comes with a free piggles.site address, so this list should not be empty. Try reloading.'
              )
        }
      />
    );
  }
  return (
    // Capped and centered: a pane torn onto a second monitor is otherwise
    // 2000px wide with the state badges a foot away from their addresses.
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      {groups.map((group) => (
        <SiteAddressCard
          key={group.site.id}
          group={group}
          activeId={props.activeId}
          onOpen={props.onOpen}
        />
      ))}
    </div>
  );
}
