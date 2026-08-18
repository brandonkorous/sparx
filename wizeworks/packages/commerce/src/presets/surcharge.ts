// Surcharge presets (kind 'surcharge') — installable payment-method fees that
// pass a transaction cost through to the customer at checkout. They install
// active (the merchant explicitly chose to add a fee). Marker is the rule name.

import type { CreateSurchargeRuleInput } from '@wizeworks/commerce-schemas';

import { surchargeService } from '../services';

import { commercePreset } from './_kit';

function surchargePreset(spec: {
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  tags: string[];
  chip: string;
  input: CreateSurchargeRuleInput;
}) {
  return commercePreset({
    slug: spec.slug,
    kind: 'surcharge',
    name: spec.name,
    description: spec.description,
    iconKey: spec.iconKey,
    tags: ['surcharge', 'fees', ...spec.tags],
    summary: [
      { label: 'Checkout fee', tone: 'neutral' },
      { label: spec.chip, tone: 'module' },
    ],
    marker: (tx, tenantId) =>
      tx.surchargeRule
        .findFirst({ where: { tenantId, name: spec.input.name }, select: { id: true } })
        .then(Boolean),
    build: async (sx) => {
      const rule = await surchargeService.createRule(sx, spec.input);
      return { id: rule.id };
    },
  });
}

export const surchargePresets = [
  surchargePreset({
    slug: 'surcharge-card-fee-3pct',
    name: 'Card processing fee (3%)',
    description:
      'Pass the card-processor fee through to the customer: 3% of the order total on card payments only. Shown as a clear line at checkout.',
    iconKey: 'credit-card',
    tags: ['card', 'processing'],
    chip: '3% on cards',
    input: {
      name: 'Card processing fee',
      type: 'percentage',
      value: 3,
      basis: 'total',
      paymentMethods: ['card'],
      appliesTo: 'checkout',
      label: 'Card processing fee',
      isActive: true,
    },
  }),
  surchargePreset({
    slug: 'surcharge-ach-fee-capped',
    name: 'ACH convenience fee (1%, max $5)',
    description:
      'A 1% convenience fee on ACH/bank payments, capped at $5 — common for B2B net-terms accounts paying by bank transfer.',
    iconKey: 'landmark',
    tags: ['ach', 'b2b', 'capped'],
    chip: '1% ACH · $5 cap',
    input: {
      name: 'ACH convenience fee',
      type: 'percentage',
      value: 1,
      basis: 'total',
      paymentMethods: ['ach'],
      appliesTo: 'checkout',
      label: 'ACH processing fee',
      capCents: 500,
      isActive: true,
    },
  }),
];
