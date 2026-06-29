// Payment-gateway presets — the commerce entries of kind 'payments'. A pack here
// selects (and, for offline, activates) a checkout gateway for the tenant. NONE
// of them writes a secret: the manual gateway needs none, and the bring-your-own
// gateways only SELECT the provider + leave it inactive until the merchant pastes
// keys in Finance → Payments (captured + AES-256-GCM encrypted on a separate
// `tenant_gateway_credentials` row, never here). A gateway choice is one-per-tenant
// (the config row is `@@unique([tenantId])`), so these are alternatives — the
// picker installs one; switching is a re-install of another.
//
// Payments live UNDER the commerce module (there is no separate `payments` flag),
// so these gate on commerce being enabled, exactly like the rest of this folder.
//
// Data-as-code (line-limit exempt).

import type { TenantContext, TxClient } from '@sparx/db';
import type { ModulePreset, ModulePresetSummaryChip } from '@sparx/auth';

import { commercePreset } from './_kit';

interface GatewaySpec {
  slug: string;
  /** The catalog gateway id written to `tenant_payment_configs.gateway_id`. */
  gatewayId: 'manual' | 'stripe_direct' | 'square';
  name: string;
  description: string;
  iconKey: string;
  tags: string[];
  summary: ModulePresetSummaryChip[];
  /** Offline gateways charge nothing, so they're live on install; BYO gateways
   *  stay inactive (no keys yet) until the merchant onboards them. */
  activateOnInstall: boolean;
}

function gatewayPreset(spec: GatewaySpec): ModulePreset {
  return commercePreset({
    slug: spec.slug,
    kind: 'payments',
    name: spec.name,
    description: spec.description,
    iconKey: spec.iconKey,
    tags: ['payments', 'checkout', ...spec.tags],
    summary: spec.summary,
    // Installed ⇔ this gateway is the tenant's current selection. (One config row
    // per tenant, so a different gateway means this preset is not installed.)
    marker: (tx: TxClient, tenantId: string) =>
      tx.tenantPaymentConfig
        .findFirst({ where: { tenantId, gatewayId: spec.gatewayId }, select: { id: true } })
        .then(Boolean),
    build: async (sx: TenantContext) => {
      // Select the gateway on the single per-tenant config row. We mirror
      // selectGateway's effect (gateway + activation state) directly on the open
      // tx so the whole install stays atomic; secrets are never touched here.
      const config = await sx.tx!.tenantPaymentConfig.upsert({
        where: { tenantId: sx.tenantId },
        create: {
          tenantId: sx.tenantId,
          gatewayId: spec.gatewayId,
          isActive: spec.activateOnInstall,
          onboardedAt: spec.activateOnInstall ? new Date() : null,
        },
        update: {
          gatewayId: spec.gatewayId,
          isActive: spec.activateOnInstall,
          onboardedAt: spec.activateOnInstall ? new Date() : null,
        },
      });
      return { id: config.id };
    },
  });
}

/** All payment-gateway presets, in picker order. */
export const paymentPresets: ModulePreset[] = [
  gatewayPreset({
    slug: 'payments-manual-offline',
    gatewayId: 'manual',
    name: 'Manual / offline payments',
    description:
      'Take payment by cash, check, wire, or bank transfer and mark orders paid by hand. No online card processing and no processing fee — the fastest way to start selling while you set up a gateway.',
    iconKey: 'banknote',
    tags: ['manual', 'offline', 'cash', 'check', 'ach', 'invoice'],
    summary: [
      { label: 'Cash · Check · Wire · ACH', tone: 'neutral' },
      { label: 'Live immediately · no fees', tone: 'module' },
    ],
    activateOnInstall: true,
  }),
  gatewayPreset({
    slug: 'payments-stripe-byo',
    gatewayId: 'stripe_direct',
    name: 'Bring your own Stripe',
    description:
      'Route checkout through your own Stripe account — you keep the full Stripe relationship, payouts, and disputes, with no sparx markup. Installs the gateway; add your API keys in Finance → Payments to go live.',
    iconKey: 'credit-card',
    tags: ['stripe', 'bring-your-own', 'cards'],
    summary: [
      { label: 'Your own Stripe account', tone: 'neutral' },
      { label: 'Add keys to go live', tone: 'module' },
    ],
    activateOnInstall: false,
  }),
  gatewayPreset({
    slug: 'payments-square-byo',
    gatewayId: 'square',
    name: 'Bring your own Square',
    description:
      'Connect your existing Square account for online and in-person payments under one ledger. Installs the gateway; add your Square credentials in Finance → Payments to start accepting cards.',
    iconKey: 'square',
    tags: ['square', 'bring-your-own', 'cards', 'pos'],
    summary: [
      { label: 'Your own Square account', tone: 'neutral' },
      { label: 'Add keys to go live', tone: 'module' },
    ],
    activateOnInstall: false,
  }),
];
