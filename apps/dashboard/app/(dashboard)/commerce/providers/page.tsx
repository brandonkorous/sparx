import { Plug } from 'lucide-react';

import type {
  ProviderInstallStatus,
  ProviderKind,
  ProviderMetadata,
} from '@sparx/commerce-schemas';
import { ListPageShell, PageHeader } from '@sparx/ui';
import { Badge } from '@wizeworks/silicaui-react';

import { api } from '@/lib/api-rest-client';
import { ensureProvidersRegistered } from '../../../../lib/providers-bootstrap';
import { ListToolbar } from '../../_components/list-toolbar';
import { getUserPreferences } from '../../_shell/preferences';
import { ProvidersLists } from './_components/providers-lists';

// Providers — tax / shipping / subscription / dropship registry, grouped by kind.
// A standard Collection/List surface (docs/34 §7): one ListToolbar view toggle flips
// every kind's Installed list together. The "Available to install" rail (bespoke
// provider cards) is preserved as-is.
//
// PAYMENT acceptance is NOT here (docs/110 Slice 5): it lives in Finance → Payments,
// the single door for how a merchant gets paid. The `payment` kind is dropped from
// the display order below; PayPal (the one payment-kind provider) is re-homed into
// the Payments surface. The provider registration stays registered (checkout + the
// install flow still resolve it) — only the duplicate management surface is folded.

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

export const dynamic = 'force-dynamic';

// `payment` is intentionally absent — payment acceptance lives in Finance → Payments
// (docs/110 Slice 5), not in the generic provider registry.
const KIND_ORDER: ProviderKind[] = ['tax', 'shipping', 'subscription_billing', 'dropship'];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProvidersPage({ searchParams }: PageProps) {
  ensureProvidersRegistered();

  const params = await searchParams;

  const [prefs, available, installed] = await Promise.all([
    getUserPreferences(),
    api.get<ProviderMetadata[]>('/v1/commerce/providers/available'),
    api.get<InstallationRow[]>('/v1/commerce/providers/installations'),
  ]);

  const installedByKind = new Map<ProviderKind, InstallationRow[]>();
  for (const inst of installed) {
    const list = installedByKind.get(inst.kind) ?? [];
    list.push(inst);
    installedByKind.set(inst.kind, list);
  }

  const groups = KIND_ORDER.map((kind) => ({
    kind,
    available: available.filter((p) => p.kinds.includes(kind)),
    installed: installedByKind.get(kind) ?? [],
  }));

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          icon={<Plug className="h-5 w-5" />}
          title="Providers"
          badge={
            <Badge color="module">
              {installed.length} installed · {available.length} available
            </Badge>
          }
          description="Pick a tax / shipping / subscription provider per environment. sparx-branded options wrap a real provider underneath (Shippo for sparx Shipping) so a merchant who doesn't want to manage carrier accounts can still transact. Sandbox installs run real provider calls against the provider's test environment. Looking to accept payments? That's in Finance → Payments."
          className="mb-0"
        />
      }
      toolbar={<ListToolbar enableViewToggle searchable={false} />}
    >
      <ProvidersLists groups={groups} view={view} />
    </ListPageShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
