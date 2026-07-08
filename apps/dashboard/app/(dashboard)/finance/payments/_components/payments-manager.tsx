'use client';

// Finance → Payments (docs/94 + docs/111). The payment-acceptance door, rendered from
// the gateway CATALOG: sparx Pay leads as a recommended hero; the bring-your-own
// processors (Stripe / Square / Authorize.net / 1stPayGateway / PayPal / custom) are a
// compact, logo-forward tile grid where each tile opens a config drawer; manual is the
// footer. One gateway is live at a time; status shows per tile. No card form renders here
// — inline gateways confirm via Elements, hosted ones send shoppers to the vendor page.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from 'silicaui-react';
import { toast } from '@sparx/ui';

import {
  type GatewayDescriptor,
  type MaskedGatewayCredential,
  type PaymentConfigState,
  type PaymentGatewayId,
  refreshSparxPayStatus,
  selectGateway,
} from '../actions';
import { GatewayDrawer } from './gateway-drawer';
import { GatewayTile, ManualRow, PayPalTile, type GatewayStatus } from './gateway-tile';
import { SparxPayHero } from './sparx-pay-hero';

export function PaymentsManager({
  initialConfig,
  catalog,
  credentials,
}: {
  initialConfig: PaymentConfigState;
  catalog: GatewayDescriptor[];
  credentials: MaskedGatewayCredential[];
}): React.JSX.Element {
  const router = useRouter();
  const [config, setConfig] = React.useState(initialConfig);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const credByGateway = React.useMemo(
    () => new Map(credentials.map((c) => [c.gatewayId, c])),
    [credentials]
  );

  // When the merchant returns from sparx Pay hosted onboarding, pull live status once.
  React.useEffect(() => {
    const needsSync =
      config.gatewayId === 'sparx_pay' && config.sparxPay.accountId !== null && !config.isActive;
    if (!needsSync) return;
    let cancelled = false;
    void refreshSparxPayStatus()
      .then((next) => !cancelled && setConfig(next))
      .catch(() => {
        /* best-effort sync */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function statusOf(g: GatewayDescriptor): GatewayStatus {
    if (config.gatewayId === g.id && config.isActive) return 'active';
    if (g.onboarding === 'api_keys') {
      return credByGateway.get(g.id)?.status === 'active' ? 'connected' : 'none';
    }
    return 'none';
  }

  function activate(gatewayId: PaymentGatewayId): void {
    if (pending) return;
    startTransition(async () => {
      try {
        setConfig(await selectGateway(gatewayId));
        const name = catalog.find((g) => g.id === gatewayId)?.name ?? 'gateway';
        toast.success(`Now accepting payments via ${name}`);
      } catch {
        toast.error('Could not switch payment method');
      }
    });
  }

  function onSaved(gatewayId: PaymentGatewayId): void {
    startTransition(async () => {
      try {
        setConfig(await selectGateway(gatewayId));
      } catch {
        /* the row saved; activation can be retried from the tile */
      }
      setOpenId(null);
      toast.success('Gateway connected');
      router.refresh();
    });
  }

  const byo = catalog.filter((g) => g.onboarding === 'api_keys');
  const manual = catalog.find((g) => g.id === 'manual');
  const openGateway = catalog.find((g) => g.id === openId) ?? null;
  const liveName =
    config.gatewayId === 'manual'
      ? 'manual records'
      : (catalog.find((g) => g.id === config.gatewayId)?.name ?? null);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-2">
        {liveName && config.isActive ? (
          <>
            <Badge color="success" variant="soft" size="sm">
              Live
            </Badge>
            <p className="text-base-content/70 text-sm">
              Accepting payments via <span className="text-base-content">{liveName}</span>.
            </p>
          </>
        ) : (
          <>
            <Badge color="warning" variant="soft" size="sm">
              Not collecting
            </Badge>
            <p className="text-base-content/70 text-sm">
              No online payment method is live yet — set one up below.
            </p>
          </>
        )}
      </div>

      <SparxPayHero
        config={config}
        active={config.gatewayId === 'sparx_pay' && config.isActive}
        onConfigChange={setConfig}
        onActivate={() => activate('sparx_pay')}
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-medium">Bring your own processor</p>
          <p className="text-base-content/70 text-sm">
            Already have a merchant account? Connect it — no sparx fee, you keep your rates.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {byo.map((g) => (
            <GatewayTile
              key={g.id}
              gateway={g}
              status={statusOf(g)}
              disabled={pending}
              onOpen={() => setOpenId(g.id)}
            />
          ))}
          <PayPalTile />
        </div>
      </div>

      {manual ? (
        <ManualRow
          gateway={manual}
          active={config.gatewayId === 'manual' && config.isActive}
          disabled={pending}
          onUse={() => activate('manual')}
        />
      ) : null}

      <GatewayDrawer
        gateway={openGateway}
        credential={openGateway ? credByGateway.get(openGateway.id) : undefined}
        status={openGateway ? statusOf(openGateway) : 'none'}
        onClose={() => setOpenId(null)}
        onSaved={() => openGateway && onSaved(openGateway.id)}
      />
    </div>
  );
}
