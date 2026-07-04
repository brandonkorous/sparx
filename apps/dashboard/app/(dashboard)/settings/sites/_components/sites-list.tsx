'use client';

import Link from 'next/link';
import { ExternalLink, Star } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Code,
  SelectionList,
  Stack,
  Text,
  type SelectionCard,
  type SelectionColumn,
} from '@sparx/ui';

import type { Domain, Property } from '@/lib/sites';
import { resolveActiveProperty } from '@/lib/site-scope';

import { EntityRowLink } from '../../../_components/entity-row-link';
import { primaryDomainOf, siteChipColor, siteStatusBadge } from '../_lib';

// The Sites list, rendered through the shared `SelectionList` dual-view substrate
// (docs/34 §7) so it gains the Table↔Cards toggle and honors the user's
// `defaultListView` — like every other list in the console. Replaces the bespoke
// full-width card-per-site form wall. Each site's name is an `EntityRowLink`,
// which opens the per-site management detail in the user's chosen surface
// (drawer / modal / full page). All the per-site editing (name, domains, module
// visibility, delete) now lives on that detail, not inline here.

interface SitesListProps {
  sites: Property[];
  domains: Domain[];
  activePropertyId: string | null;
  view: 'table' | 'card';
}

// A small brand avatar: the site's initial over its brand colour. Inline style
// (not utility classes) so a data-driven colour can't trip the control-reskin lint.
function SiteChip({ site }: { site: Property }) {
  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-medium"
      style={{ background: siteChipColor(site), color: '#fff' }}
    >
      {site.name.trim().charAt(0).toUpperCase() || 'S'}
    </span>
  );
}

export function SitesList({ sites, domains, activePropertyId, view }: SitesListProps) {
  // The site the Builder is currently authoring (cookie id → primary → first) —
  // the shared rule, same as the breadcrumb switcher and every list page.
  const activeId = resolveActiveProperty(sites, activePropertyId)?.id;

  const domainsByProperty = new Map<string, Domain[]>();
  for (const d of domains) {
    const list = domainsByProperty.get(d.propertyId) ?? [];
    list.push(d);
    domainsByProperty.set(d.propertyId, list);
  }
  const siteDomains = (p: Property) => domainsByProperty.get(p.id) ?? [];

  const nameLink = (p: Property, className: string) => (
    <EntityRowLink
      href={`/settings/sites/${p.id}`}
      entityType="site"
      entityId={p.id}
      className={className}
    >
      {p.name}
    </EntityRowLink>
  );

  const badges = (p: Property) => (
    <>
      {p.isPrimary && (
        <Badge color="module" variant="soft" size="sm">
          <Star className="h-3 w-3" /> Primary
        </Badge>
      )}
      {p.id === activeId && (
        <Badge color="success" variant="soft" size="sm">
          Editing now
        </Badge>
      )}
    </>
  );

  const domainCell = (p: Property) => {
    const primary = primaryDomainOf(siteDomains(p));
    if (!primary) {
      return (
        <Text size="sm" variant="muted">
          No domain yet
        </Text>
      );
    }
    return (
      <a
        href={`https://${primary.host}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--module-active)]"
      >
        {primary.host}
        <ExternalLink className="h-3 w-3 opacity-60" />
      </a>
    );
  };

  const statusCell = (p: Property) => {
    const s = siteStatusBadge(p);
    return (
      <Badge color={s.color} variant="soft">
        {s.label}
      </Badge>
    );
  };

  const columns: SelectionColumn<Property>[] = [
    {
      header: 'Site',
      cell: (p) => (
        <Stack direction="row" align="center" gap={3} className="min-w-0">
          <SiteChip site={p} />
          <Stack gap={1} className="min-w-0">
            <Stack direction="row" align="center" gap={2} wrap>
              {nameLink(p, 'text-sm font-medium hover:text-[var(--module-active)] hover:underline')}
              {badges(p)}
            </Stack>
            <Text size="xs" variant="muted">
              Handle <Code>{p.slug}</Code>
            </Text>
          </Stack>
        </Stack>
      ),
    },
    { header: 'Primary domain', cell: domainCell },
    { header: 'Status', cell: statusCell },
    {
      header: 'Domains',
      align: 'right',
      cell: (p) => (
        <Text size="sm" variant="muted">
          {siteDomains(p).length}
        </Text>
      ),
    },
    {
      header: '',
      id: 'actions',
      align: 'right',
      cell: (p) => (
        <Button asChild variant="ghost" size="sm">
          <Link href={`/settings/sites/${p.id}`}>Manage</Link>
        </Button>
      ),
    },
  ];

  const card: SelectionCard<Property> = {
    title: (p) => nameLink(p, 'text-base font-medium'),
    render: (p) => {
      const primary = primaryDomainOf(siteDomains(p));
      const s = siteStatusBadge(p);
      return (
        <Card variant="default" padding="md">
          <Stack gap={3}>
            <Stack direction="row" align="start" gap={3}>
              <SiteChip site={p} />
              <Stack gap={1} className="min-w-0 flex-1">
                <Stack direction="row" align="center" gap={2} wrap>
                  {nameLink(
                    p,
                    'text-base font-medium hover:text-[var(--module-active)] hover:underline'
                  )}
                  {badges(p)}
                </Stack>
                <Text size="xs" variant="muted">
                  Handle <Code>{p.slug}</Code>
                </Text>
              </Stack>
              <Badge color={s.color} variant="soft">
                {s.label}
              </Badge>
            </Stack>
            <Stack direction="row" align="center" justify="between" gap={2}>
              {primary ? (
                <a
                  href={`https://${primary.host}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--module-active)]"
                >
                  {primary.host}
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              ) : (
                <Text size="sm" variant="muted">
                  {siteDomains(p).length} domains
                </Text>
              )}
              <Button asChild variant="ghost" size="sm">
                <Link href={`/settings/sites/${p.id}`}>Manage</Link>
              </Button>
            </Stack>
          </Stack>
        </Card>
      );
    },
  };

  return (
    <SelectionList
      items={sites}
      view={view}
      getId={(p) => p.id}
      getRowLabel={(p) => p.name}
      entityLabelPlural="sites"
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
