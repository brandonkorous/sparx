'use client';

import Link from 'next/link';
import { SelectionList, type SelectionCard, type SelectionColumn } from '@sparx/ui';
import { Badge } from '@wizeworks/silicaui-react';

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
      cell: (s) => <p className="text-base-content/70 text-sm">{vendorLabel(s.type)}</p>,
    },
    { header: 'Status', cell: statusBadge },
    ...(showSites
      ? [
          {
            header: 'Sites',
            id: 'sites',
            cell: (s: Supplier) => (
              <p className="text-base-content/70 text-sm">{formatSiteScope(s.siteScope)}</p>
            ),
          } satisfies SelectionColumn<Supplier>,
        ]
      : []),
    {
      header: 'Pricing rule',
      cell: (s) => (
        <p className="text-base-content/70 text-sm">{formatPricingRule(s.pricingRule)}</p>
      ),
    },
    {
      header: 'Last synced',
      cell: (s) => (
        <p className="text-base-content/70 text-sm">
          {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleDateString() : 'Never'}
        </p>
      ),
    },
    { header: 'Actions', id: 'actions', cell: rowActions },
  ];

  const card: SelectionCard<Supplier> = {
    title: (s) => nameLink(s, 'truncate text-sm font-medium hover:underline'),
    subtitle: (s) => <p className="text-base-content/70 text-xs">{vendorLabel(s.type)}</p>,
    badge: statusBadge,
    body: (s) => (
      <>
        {showSites ? (
          <div className="flex flex-row items-center justify-between gap-2">
            <p className="text-base-content/70 text-sm">Sites</p>
            <p className="text-base-content/70 text-sm">{formatSiteScope(s.siteScope)}</p>
          </div>
        ) : null}
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-sm">{formatPricingRule(s.pricingRule)}</p>
          <p className="text-base-content/70 text-xs">
            {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleDateString() : 'Never'}
          </p>
        </div>
        <div className="flex flex-row justify-end">{rowActions(s)}</div>
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
