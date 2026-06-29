// Markup rule presets (kind 'markup') — installable cost→price rules. Each is a
// catalog-scoped pricing strategy the merchant can drop in and tune. They install
// active; the merchant typically picks ONE. Marker is the rule name.

import type { CreateMarkupRuleInput } from '@sparx/commerce-schemas';

import { markupService } from '../services';

import { commercePreset } from './_kit';

function markupPreset(spec: {
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  tags: string[];
  chip: string;
  input: CreateMarkupRuleInput;
}) {
  return commercePreset({
    slug: spec.slug,
    kind: 'markup',
    name: spec.name,
    description: spec.description,
    iconKey: spec.iconKey,
    tags: ['markup', 'pricing', ...spec.tags],
    summary: [
      { label: 'All products', tone: 'neutral' },
      { label: spec.chip, tone: 'module' },
    ],
    marker: (tx, tenantId) =>
      tx.markupRule
        .findFirst({ where: { tenantId, name: spec.input.name }, select: { id: true } })
        .then(Boolean),
    build: async (sx) => {
      const rule = await markupService.createRule(sx, spec.input);
      return { id: rule.id };
    },
  });
}

export const markupPresets = [
  markupPreset({
    slug: 'markup-keystone',
    name: 'Keystone pricing (2×)',
    description:
      'The classic retail rule: price every product at twice its cost (a 50% margin). A fast, predictable baseline you can refine per collection later.',
    iconKey: 'gem',
    tags: ['keystone', 'multiplier'],
    chip: '×2 cost',
    input: {
      name: 'Keystone pricing',
      method: 'multiplier',
      value: 2,
      costBasis: 'variant_cost',
      ceilingSrc: 'none',
      appliesTo: 'catalog',
      scope: { type: 'all' },
      priority: 0,
      isActive: true,
      recomputeMode: 'auto',
    },
  }),
  markupPreset({
    slug: 'markup-standard-40',
    name: 'Standard 40% markup',
    description:
      'Add 40% to cost across the catalog — a conservative, broadly-applicable markup that leaves room for discounts.',
    iconKey: 'percent',
    tags: ['percentage', 'standard'],
    chip: '+40%',
    input: {
      name: 'Standard 40% markup',
      method: 'percentage',
      value: 0.4,
      costBasis: 'variant_cost',
      ceilingSrc: 'none',
      appliesTo: 'catalog',
      scope: { type: 'all' },
      priority: 0,
      isActive: true,
      recomputeMode: 'auto',
    },
  }),
  markupPreset({
    slug: 'markup-margin-50-charm',
    name: '50% margin with .99 pricing',
    description:
      'Target a 50% margin on every product and round prices up to a charming “.99” ending — a retail-psychology favourite.',
    iconKey: 'trending-up',
    tags: ['margin', 'charm-pricing'],
    chip: '50% margin · .99',
    input: {
      name: '50% margin target',
      method: 'margin_target',
      value: 0.5,
      rounding: { strategy: 'charm', endingCents: 99 },
      costBasis: 'variant_cost',
      ceilingSrc: 'none',
      appliesTo: 'catalog',
      scope: { type: 'all' },
      priority: 0,
      isActive: true,
      recomputeMode: 'auto',
    },
  }),
];
