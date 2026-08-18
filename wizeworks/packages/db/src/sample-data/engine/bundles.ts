// Bundles + configurator slice — commerce-gated.
//
// A bundle turns an existing pack product into a kit whose components are other
// products' default variants (the cross-sell story). The configurator pins an
// option matrix onto one product. Both cascade away with their wrapper/pinned
// product on Clear — EXCEPT bundle COMPONENTS pin their variant with onDelete
// Restrict, so Clear deletes sample bundles before sample products (see ./clear.ts).

import type { SampleDataPack } from '../types';
import type { ApplyCtx, VariantMeta } from './context';

const PRICING_MODE = {
  fixed: 'fixed',
  percent: 'percent_off_sum',
  sum: 'sum_of_components',
} as const;
const OPTION_TYPE: Record<string, string> = {
  single: 'single_choice',
  swatch: 'color_swatch',
  toggle: 'toggle',
  quantity: 'quantity',
};

/** productKey → its default (first-authored) variant. */
function defaultVariantByProduct(ctx: ApplyCtx): Map<string, VariantMeta> {
  const map = new Map<string, VariantMeta>();
  for (const vkey of ctx.variantOrder) {
    const meta = ctx.variantsByKey.get(vkey)!;
    if (!map.has(meta.productKey)) map.set(meta.productKey, meta);
  }
  return map;
}

export async function applyBundlesAndConfigurator(
  ctx: ApplyCtx,
  pack: SampleDataPack
): Promise<void> {
  if (!ctx.isOn('commerce')) return;
  const { tx, tenantId } = ctx;
  const defaultVariant = defaultVariantByProduct(ctx);

  for (const bundle of pack.bundles ?? []) {
    const bundleProductId = ctx.productIdByKey.get(bundle.wrapperProductKey);
    if (!bundleProductId) continue;
    const row = await tx.bundle.create({
      data: {
        tenantId,
        bundleProductId,
        pricingMode: PRICING_MODE[bundle.pricing.mode],
        ...(bundle.pricing.mode === 'fixed' ? { fixedPriceCents: bundle.pricing.priceCents } : {}),
        ...(bundle.pricing.mode === 'percent' ? { percentOffSum: bundle.pricing.percentOff } : {}),
        inventoryMode:
          bundle.inventoryMode === 'bundle' ? 'decrement_bundle_sku' : 'decrement_components',
      },
      select: { id: true },
    });
    for (const [i, comp] of bundle.components.entries()) {
      const meta = defaultVariant.get(comp.productKey);
      if (!meta) continue;
      await tx.bundleComponent.create({
        data: {
          tenantId,
          bundleId: row.id,
          variantId: meta.id,
          defaultQuantity: comp.quantity ?? 1,
          isRequired: comp.required ?? true,
          isSwappable: comp.swappable ?? false,
          productIdSwappable: comp.swappable ? meta.productId : null,
          position: i,
        },
      });
    }
    ctx.counts.bundles += 1;
  }

  const cfg = pack.configurator;
  if (cfg) {
    const productId = ctx.productIdByKey.get(cfg.productKey);
    if (productId) {
      const template = await tx.configurationTemplate.create({
        data: { tenantId, productId, name: cfg.name, status: 'active' },
        select: { id: true },
      });
      for (const [i, opt] of cfg.options.entries()) {
        const defaults = opt.choices.filter((c) => c.isDefault).map((c) => c.value);
        const choices = opt.choices.map((c) => ({
          key: c.value,
          label: c.label,
          priceDeltaCents: c.priceDeltaCents ?? 0,
          ...(c.swatchHex ? { swatchHex: c.swatchHex } : {}),
        }));
        await tx.configurationOption.create({
          data: {
            tenantId,
            templateId: template.id,
            key: opt.key,
            label: opt.label,
            type: OPTION_TYPE[opt.inputType] ?? opt.inputType,
            required: defaults.length > 0,
            defaultChoiceKeys: defaults,
            choices: choices,
            position: i,
          },
        });
      }
      for (const [i, addon] of (cfg.addOns ?? []).entries()) {
        const meta = ctx.variantsByKey.get(addon.variantKey);
        if (!meta) continue;
        await tx.configurationAddOn.create({
          data: {
            tenantId,
            templateId: template.id,
            variantId: meta.id,
            defaultIncluded: addon.defaultIncluded ?? false,
            priceOverrideCents: addon.priceOverrideCents ?? null,
            position: i,
          },
        });
      }
    }
  }
}
