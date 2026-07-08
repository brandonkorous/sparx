'use client';

import Link from 'next/link';
import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Plug,
  Puzzle,
  Receipt,
  Truck,
  Wallet,
} from 'lucide-react';

import type {
  ProviderInstallStatus,
  ProviderKind,
  ProviderMetadata,
} from '@sparx/commerce-schemas';
import { SelectionList, type SelectionCard, type SelectionColumn } from '@sparx/ui';
import { Badge, Button, Card, CardBody, EmptyState } from 'silicaui-react';

import { EntityRowLink } from '../../../_components/entity-row-link';

// Client wrapper for the Providers registry (docs/34 §7). The registry is
// GROUPED BY KIND (payment / tax / shipping / …). Each kind renders its own
// "Installed" SelectionList — SelectionList takes render functions, which can't
// cross the server→client boundary, so the server page hands the grouped data +
// a shared `view` here. Read-only — `selectable={false}`; rows open the
// installation detail via EntityRowLink. The single `view` from the page-level
// ListToolbar flips EVERY kind's Installed list together. The "Available to
// install" rail (bespoke provider cards + Install CTAs) is preserved verbatim.

interface InstallationRow {
  id: string;
  providerSlug: string;
  kind: ProviderKind;
  environment: 'sandbox' | 'production';
  enabled: boolean;
  status: ProviderInstallStatus;
  label: string | null;
  providerAccountId: string | null;
  lastHealthCheckAt: string | null;
  lastHealthStatus: string | null;
  errorCount: number;
  installedAt: string;
}

interface KindGroup {
  kind: ProviderKind;
  available: ProviderMetadata[];
  installed: InstallationRow[];
}

const KIND_ICON: Record<ProviderKind, typeof Wallet> = {
  payment: Wallet,
  tax: Receipt,
  shipping: Truck,
  subscription_billing: Plug,
  dropship: Puzzle,
  identity: Plug,
};

const KIND_LABEL: Record<ProviderKind, string> = {
  payment: 'Payment',
  tax: 'Tax',
  shipping: 'Shipping',
  subscription_billing: 'Subscription billing',
  dropship: 'Dropship',
  identity: 'Identity',
};

const KIND_DESCRIPTION: Record<ProviderKind, string> = {
  payment:
    'Charges cards / wallets / ACH. A merchant must install at least one before checkout can process payment.',
  tax: 'Real-time tax calculation. Wins over the manual fallback rates in Commerce → Tax.',
  shipping:
    'Live carrier rates + label purchase. Without one installed the storefront uses manual rates from Commerce → Shipping.',
  subscription_billing:
    'Schedules recurring charges for subscriptions. Most payment providers double as the subscription engine.',
  dropship:
    'Supplier catalog ingest + order forwarding. Dropship products route their fulfillment through the supplier API.',
  identity:
    'External identity / OAuth. Reserved for a future module — Better Auth handles sparx-side identity today.',
};

export function ProvidersLists({ groups, view }: { groups: KindGroup[]; view: 'table' | 'card' }) {
  return (
    <>
      {groups.map((group) => (
        <KindSection key={group.kind} group={group} view={view} />
      ))}
    </>
  );
}

function KindSection({ group, view }: { group: KindGroup; view: 'table' | 'card' }) {
  const { kind, available, installed } = group;
  const Icon = KIND_ICON[kind];

  return (
    <Card>
      <CardBody>
        <div className="flex flex-col gap-1">
          <div className="flex flex-row items-center gap-2">
            <Icon className="h-4 w-4" />
            <h3 className="text-xl font-semibold">{KIND_LABEL[kind]}</h3>
            <Badge color="neutral" variant="soft" size="sm">
              {installed.length} installed
            </Badge>
          </div>
          <p className="opacity-70">{KIND_DESCRIPTION[kind]}</p>
        </div>
        <div className="flex flex-col gap-5">
          {installed.length > 0 && (
            <div className="flex flex-col gap-2">
              <h4 className="text-lg font-semibold">Installed</h4>
              <SelectionList
                items={installed}
                view={view}
                getId={(inst) => inst.id}
                selectable={false}
                entityLabelPlural="installations"
                getRowLabel={(inst) => inst.label ?? inst.providerSlug}
                columns={installedColumns}
                card={installedCard}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <h4 className="text-lg font-semibold">Available to install</h4>
            {available.length === 0 ? (
              <EmptyState
                icon={<Icon className="h-5 w-5" />}
                title={`No ${KIND_LABEL[kind].toLowerCase()} providers available`}
                description="Provider bundles register at server boot."
              />
            ) : (
              <div className="flex flex-col gap-2">
                {available.map((p) => (
                  <ProviderCard key={p.slug} provider={p} kind={kind} />
                ))}
              </div>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function ProviderCard({ provider, kind }: { provider: ProviderMetadata; kind: ProviderKind }) {
  return (
    <div className="flex flex-row items-start justify-between gap-4 rounded border border-[var(--color-border-default)] p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-row items-center gap-2">
          <p className="text-base font-medium">{provider.displayName}</p>
          {provider.whitelabelOf && (
            <Badge color="neutral" variant="soft" size="sm">
              powered by {provider.whitelabelOf}
            </Badge>
          )}
          {provider.sandboxAvailable && (
            <Badge color="info" variant="soft" size="sm">
              sandbox
            </Badge>
          )}
        </div>
        <p className="text-base-content/70 text-sm">{provider.description}</p>
        <div className="flex flex-row flex-wrap gap-1 pt-1">
          {provider.supportedCountries.slice(0, 8).map((c) => (
            <Badge key={c} color="neutral" variant="soft" size="sm">
              {c}
            </Badge>
          ))}
          {provider.supportedCountries.length > 8 && (
            <Badge color="neutral" variant="soft" size="sm">
              +{provider.supportedCountries.length - 8}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Button
          color="module"
          render={<Link href={`/commerce/providers/install?slug=${provider.slug}&kind=${kind}`} />}
        >
          Install
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ProviderInstallStatus }) {
  const map: Record<
    ProviderInstallStatus,
    { icon: typeof CircleCheck; variant: 'success' | 'warning' | 'neutral' }
  > = {
    active: { icon: CircleCheck, variant: 'success' },
    pending_configuration: { icon: CircleDashed, variant: 'neutral' },
    pending_oauth: { icon: CircleDashed, variant: 'neutral' },
    pending_verification: { icon: CircleDashed, variant: 'neutral' },
    errored: { icon: CircleAlert, variant: 'warning' },
    disabled: { icon: CircleAlert, variant: 'neutral' },
  };
  const entry = map[status];
  const Icon = entry.icon;
  return (
    <Badge color={entry.variant}>
      <Icon className="mr-1 inline h-3 w-3" />
      {status}
    </Badge>
  );
}

const installedProvider = (inst: InstallationRow) => (
  <EntityRowLink
    href={`/commerce/providers/${inst.id}`}
    entityType="provider-installation"
    entityId={inst.id}
    className="font-medium hover:text-[var(--module-active)]"
  >
    {inst.providerSlug}
  </EntityRowLink>
);

const installedLabel = (inst: InstallationRow) =>
  inst.label ?? <p className="text-base-content/70 text-xs">—</p>;

const installedEnvironment = (inst: InstallationRow) => (
  <Badge color={inst.environment === 'production' ? 'success' : 'warning'}>
    {inst.environment}
  </Badge>
);

const installedHealth = (inst: InstallationRow) => (
  <>
    {inst.lastHealthCheckAt ? new Date(inst.lastHealthCheckAt).toLocaleString() : 'never'}
    {inst.errorCount > 0 && (
      <Badge color="warning" className="ml-2">
        {inst.errorCount} errors
      </Badge>
    )}
  </>
);

const installedColumns: SelectionColumn<InstallationRow>[] = [
  { header: 'Provider', cell: installedProvider },
  { header: 'Label', cell: installedLabel },
  { header: 'Environment', cell: installedEnvironment },
  { header: 'Status', cell: (inst) => <StatusBadge status={inst.status} /> },
  { header: 'Health', cell: installedHealth },
];

const installedCard: SelectionCard<InstallationRow> = {
  title: installedProvider,
  badge: (inst) => <StatusBadge status={inst.status} />,
  body: (inst) => (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row flex-wrap items-center gap-2">
        {installedEnvironment(inst)}
        {inst.label ? <p className="text-base-content/70 text-xs">{inst.label}</p> : null}
      </div>
      <div className="flex flex-row flex-wrap items-center gap-1 text-xs text-[var(--color-text-secondary)]">
        <span>Health:</span>
        {installedHealth(inst)}
      </div>
    </div>
  ),
};
