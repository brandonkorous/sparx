import { notFound } from 'next/navigation';

import type {
  ProviderInstallStatus,
  ProviderKind,
  ProviderMetadata,
} from '@sparx/commerce-schemas';
import { statusLabel } from '@sparx/ui';
import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import { ensureProvidersRegistered } from '../../../../../lib/providers-bootstrap';
import { DetailHeaderSlot } from '../../../_components/detail-header-slot';

import { ProviderActionsBar } from './_components/provider-actions-bar';

export const dynamic = 'force-dynamic';

interface Props {
  id: string;
}

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

export async function ProviderInstallationDetailContent({ id }: Props) {
  ensureProvidersRegistered();

  let installation: InstallationRow | null;
  try {
    installation = await api.get<InstallationRow | null>(
      `/v1/commerce/providers/installations/${id}`
    );
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }
  if (!installation) notFound();

  const metadata = await api.get<ProviderMetadata | null>(
    `/v1/commerce/providers/metadata/${encodeURIComponent(installation.providerSlug)}`
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Lifecycle controls teleport into the shared detail chrome's header
          (drawer/modal chrome or the full-page shell), parity with Product. */}
      <DetailHeaderSlot>
        <ProviderActionsBar installationId={installation.id} enabled={installation.enabled} />
      </DetailHeaderSlot>

      <div className="flex flex-row flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex flex-row items-center gap-2">
            <h1 className="text-3xl font-semibold">
              {metadata?.displayName ?? installation.providerSlug}
            </h1>
            <Badge color="info" variant="soft" size="sm">
              {statusLabel(installation.kind)}
            </Badge>
            <Badge
              color={installation.environment === 'production' ? 'success' : 'warning'}
              variant="soft"
              size="sm"
            >
              {statusLabel(installation.environment)}
            </Badge>
            <Badge color={installation.enabled ? 'success' : 'neutral'} variant="soft" size="sm">
              {installation.enabled ? 'enabled' : 'disabled'}
            </Badge>
          </div>
          {installation.label && <p className="text-base-content text-sm">{installation.label}</p>}
        </div>
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Status</h3>
            <p className="opacity-70">
              The platform records every successful + failed call here; persistent errors surface to
              the dashboard alerts strip.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Row label="Status" value={installation.status} />
            <Row
              label="Last health check"
              value={
                installation.lastHealthCheckAt
                  ? `${installation.lastHealthStatus ?? 'unknown'} · ${new Date(
                      installation.lastHealthCheckAt
                    ).toLocaleString()}`
                  : 'never'
              }
            />
            <Row label="Error count" value={String(installation.errorCount)} />
            <Row label="Provider account id" value={installation.providerAccountId ?? '—'} />
            <Row label="Installed" value={new Date(installation.installedAt).toLocaleString()} />
          </div>
        </CardBody>
      </Card>

      {metadata && (
        <Card>
          <CardBody>
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-semibold">Webhook</h3>
              <p className="opacity-70">
                Paste this URL into the provider&apos;s webhook configuration so callbacks land at
                the right tenant. The path&apos;s <code>:installationId</code> token is auto-filled
                on dispatch.
              </p>
            </div>
            <p className="font-mono text-xs">
              {metadata.webhookPathTemplate.replace(':installationId', installation.id)}
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-row gap-4">
      <p className="text-base-content w-40 text-sm">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
