'use client';

import Link from 'next/link';
import {
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Badge,
  Stack,
  Text,
} from '@sparx/ui';

import { SupplierActions } from './supplier-actions';
import type { SiteOption, Vendor, VendorCredentialField } from './supplier-form';

// Client wrapper for the dropship suppliers list. SelectionList takes render
// functions (columns/card) that can't cross the server→client boundary, so the
// server page hands serializable rows + view (and the vendor/site lookups the
// row actions need) here, and this builds both views. Read-only selection
// (`selectable={false}`, no bulk bar); each row carries the per-row
// SupplierActions menu (sync / edit / disconnect). The "Sites" column only
// renders for multi-site tenants — mirrored from the server page.

interface Supplier {
  id: string;
  name: string;
  type: string;
  status: string;
  lastSyncAt: string | null;
  pricingRule: { type: string; value: number } | null;
  notes: string | null;
  createdAt: string;
  credentialFields?: VendorCredentialField[];
  credentialsSet?: boolean;
  siteScope?: string[];
}

interface SuppliersListProps {
  suppliers: Supplier[];
  view: 'table' | 'card';
  sites: SiteOption[];
  vendors: Vendor[];
  showSites: boolean;
}

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  connecting: 'warning',
  error: 'danger',
  disconnected: 'neutral',
};

function formatPricingRule(rule: { type: string; value: number } | null) {
  if (!rule) return '—';
  switch (rule.type) {
    case 'percentage_markup':
      return `+${rule.value}% markup`;
    case 'multiplier':
      return `×${rule.value}`;
    case 'flat_markup':
      return `+$${(rule.value / 100).toFixed(2)} flat`;
    case 'fixed_margin':
      return `${rule.value}% margin`;
    default:
      return rule.type;
  }
}

export function SuppliersList({ suppliers, view, sites, vendors, showSites }: SuppliersListProps) {
  const vendorLabel = (type: string) => vendors.find((v) => v.slug === type)?.label ?? type;
  const siteNameById = new Map(sites.map((s) => [s.id, s.name]));
  const formatSiteScope = (scope: string[] | undefined) => {
    if (!scope || scope.length === 0) return 'All sites';
    return scope.map((id) => siteNameById.get(id) ?? '—').join(', ');
  };

  const nameLink = (s: Supplier, className: string) => (
    <Link href={`/dropship/suppliers/${s.id}/catalog`} className={className}>
      {s.name}
    </Link>
  );

  const statusBadge = (s: Supplier) => (
    <Badge color={STATUS_COLOR[s.status] ?? 'neutral'} variant="soft" size="sm">
      {s.status}
    </Badge>
  );

  const rowActions = (s: Supplier) => (
    <SupplierActions supplier={s} sites={sites} vendors={vendors} />
  );

  const columns: SelectionColumn<Supplier>[] = [
    { header: 'Supplier', cell: (s) => nameLink(s, 'text-sm font-medium hover:underline') },
    {
      header: 'Type',
      cell: (s) => (
        <Text size="sm" className="text-[var(--color-muted-foreground)]">
          {vendorLabel(s.type)}
        </Text>
      ),
    },
    { header: 'Status', cell: statusBadge },
    ...(showSites
      ? [
          {
            header: 'Sites',
            id: 'sites',
            cell: (s: Supplier) => (
              <Text size="sm" className="text-[var(--color-muted-foreground)]">
                {formatSiteScope(s.siteScope)}
              </Text>
            ),
          } satisfies SelectionColumn<Supplier>,
        ]
      : []),
    {
      header: 'Pricing rule',
      cell: (s) => (
        <Text size="sm" className="text-[var(--color-muted-foreground)]">
          {formatPricingRule(s.pricingRule)}
        </Text>
      ),
    },
    {
      header: 'Last synced',
      cell: (s) => (
        <Text size="sm" className="text-[var(--color-muted-foreground)]">
          {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleDateString() : 'Never'}
        </Text>
      ),
    },
    { header: 'Actions', id: 'actions', cell: rowActions },
  ];

  const card: SelectionCard<Supplier> = {
    title: (s) => nameLink(s, 'truncate text-sm font-medium hover:underline'),
    subtitle: (s) => (
      <Text size="xs" className="text-[var(--color-muted-foreground)]">
        {vendorLabel(s.type)}
      </Text>
    ),
    badge: statusBadge,
    body: (s) => (
      <>
        {showSites ? (
          <Stack direction="row" align="center" justify="between" gap={2}>
            <Text size="sm" className="text-[var(--color-muted-foreground)]">
              Sites
            </Text>
            <Text size="sm" className="text-[var(--color-muted-foreground)]">
              {formatSiteScope(s.siteScope)}
            </Text>
          </Stack>
        ) : null}
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="sm" className="text-[var(--color-muted-foreground)]">
            {formatPricingRule(s.pricingRule)}
          </Text>
          <Text size="xs" className="text-[var(--color-muted-foreground)]">
            {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleDateString() : 'Never'}
          </Text>
        </Stack>
        <Stack direction="row" justify="end">
          {rowActions(s)}
        </Stack>
      </>
    ),
  };

  return (
    <SelectionList
      items={suppliers}
      view={view}
      getId={(s) => s.id}
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
