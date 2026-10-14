'use client';

// Payment providers: the services that take a customer's money, and which one is
// doing it now. Setting one up is real work (keys, or a hosted onboarding), so each
// provider row opens its own pane that does the real thing; no "Connect" to nowhere.

import { Badge, Card } from '@wizeworks/silicaui-react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { faServer } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import {
  checkoutSummary,
  useGatewayCatalog,
  useGatewayCredentials,
  usePaymentConfig,
} from './providers-data';
import { productHidesFeature } from '../../lib/product';
import { ProvidersList } from './payment-providers-list';

/** Registry module for this pane, so the brand draws Sell's own picture. */
const MODULE = 'commerce';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** The three reads, the providers this brand offers, and the one in use. */
function usePaymentSetup() {
  const config = usePaymentConfig();
  const catalog = useGatewayCatalog();
  const credentials = useGatewayCredentials();
  const refetchAll = () => {
    void config.refetch();
    void catalog.refetch();
    void credentials.refetch();
  };
  // The catalog is the PLATFORM's list; a brand that does not operate a processor
  // (sparx Pay, for Piggles) leaves it out. See ProductAdapter.hiddenFeatures.
  const gateways = (catalog.data ?? []).filter(
    (gateway) => !productHidesFeature(`commerce.payments.${gateway.id}`)
  );
  const active = config.data && gateways.find((g) => g.id === config.data?.gatewayId);
  return { config, catalog, credentials, refetchAll, gateways, active: active ?? undefined };
}

function ProvidersToolbar({
  summary,
  isFetching,
  updatedAt,
  onRefresh,
}: {
  summary: ReturnType<typeof checkoutSummary>;
  isFetching: boolean;
  updatedAt: number | undefined;
  onRefresh: () => void;
}) {
  return (
    <PaneToolbar
      label="Controls for how you take payment"
      status={
        summary ? (
          <Badge color={summary.tone} variant="soft" size="sm">
            {summary.label}
          </Badge>
        ) : null
      }
      refresh={
        <RefreshButton isFetching={isFetching} updatedAt={updatedAt} onRefresh={onRefresh} />
      }
    />
  );
}

export function PaymentProvidersSurface({ ctx }: { ctx: SurfaceContext }) {
  const { config, catalog, credentials, refetchAll, gateways, active } = usePaymentSetup();

  return (
    <div className={PANE_SHELL}>
      <ProvidersToolbar
        summary={checkoutSummary(active, Boolean(config.data?.isActive))}
        isFetching={config.isFetching || catalog.isFetching || credentials.isFetching}
        updatedAt={config.data ? config.dataUpdatedAt : undefined}
        onRefresh={refetchAll}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {/* Both non-ready states are carded, because the ready one is a
              FormSection, already a card. */}
          {config.isError || catalog.isError ? (
            <Card>
              <PaneLoadError
                module={MODULE}
                icon={<Icon glyph={faServer} className="size-6" aria-hidden />}
                title="Could not load how you take payment"
                description="This is a problem reaching the server. Your payment setup is unaffected."
                error={config.error ?? catalog.error}
                onRetry={refetchAll}
              />
            </Card>
          ) : config.isPending || catalog.isPending ? (
            <Card>
              <PaneWaiting module={MODULE} />
            </Card>
          ) : (
            <ProvidersList
              gateways={gateways}
              active={active}
              config={config.data}
              credentials={credentials.data ?? []}
              onOpen={(id, event) => {
                ctx.open('commerce.provider.detail', { key: id }, { target: targetFor(event) });
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
