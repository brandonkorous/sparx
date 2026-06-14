'use client';

// Product creation wizard (docs/68 B-1, docs/86 WizardFrame).
//
// The comprehensive guided flow for adding a catalog product and walking the
// merchant through its relations, on the platform's full-page WizardFrame.
//
// Architecture (confirmed with the user): the product is created as a DRAFT the
// moment Basics is completed, then each later step attaches a relation to the
// real product via the SAME endpoints the detail tabs use (default variant +
// pricing, inventory levels, …). Review flips the draft to Published (or leaves
// it a draft). Abandoning mid-flow offers to discard the draft so we never leak
// an empty product.
//
// Steps adapt to fulfillment type: digital / service products skip the physical
// Inventory & shipping step.
//
// SLICE 1 (this file) covers the spine: Basics → Pricing → Inventory & shipping
// → Review. Variants & options, Media, Organization and Fitment land as
// additional steps inserted before Review, each reusing the detail-tab tooling
// against the draft product id.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Input,
  Label,
  ModuleProvider,
  NativeSelect,
  Switch,
  Text,
  Textarea,
  WizardFrame,
  WizardStep,
  useConfirm,
  type WizardStepDef,
} from '@sparx/ui';

import {
  createProductAction,
  deleteProductAction,
  publishProductAction,
  updateProductAction,
} from '../../../product-actions';
import { createVariantAction, updateVariantAction } from '../../../variant-actions';
import {
  adjustInventoryAction,
  listWarehousesAction,
  setReorderPolicyAction,
} from '../../../inventory-actions';
import { OrganizationStep } from './organization-step';

// ─── Types & constants ─────────────────────────────────────────────────────────

type FulfillmentType = 'physical' | 'digital' | 'service';
type HazmatClass =
  | 'none'
  | 'flammable_liquid'
  | 'flammable_solid'
  | 'gas'
  | 'oxidizer'
  | 'toxic'
  | 'corrosive'
  | 'radioactive'
  | 'misc';

interface WarehouseOption {
  id: string;
  code: string;
  name: string;
}

type StepKey = 'basics' | 'pricing' | 'inventory' | 'organization' | 'review';

const ALL_STEPS: Record<StepKey, WizardStepDef> = {
  basics: { key: 'basics', label: 'Basics', sublabel: 'Name & type' },
  pricing: { key: 'pricing', label: 'Pricing', sublabel: 'Price & tax' },
  inventory: { key: 'inventory', label: 'Inventory', sublabel: 'Stock & shipping' },
  organization: { key: 'organization', label: 'Organize', sublabel: 'Collections & sites' },
  review: { key: 'review', label: 'Review', sublabel: 'Confirm & publish' },
};

// Per-step rail copy (the colored rail narrates the journey).
const RAIL: Record<StepKey, { title: string; blurb: string; context?: string }> = {
  basics: {
    title: 'Start with the basics',
    blurb: 'Name the product and tell us how it ships. We save it as a draft so nothing is lost.',
    context: 'Only the title is required — everything else can change later.',
  },
  pricing: {
    title: 'Set the price',
    blurb: 'The selling price, an optional “compare at” for showing a markdown, and your cost.',
    context: 'This creates the default variant. Add more variants in the next slice.',
  },
  inventory: {
    title: 'Stock & shipping',
    blurb:
      'Track stock per warehouse, set a reorder point, and give us the shipping weight & size.',
    context: 'Skip any of this — you can manage inventory anytime from the product.',
  },
  organization: {
    title: 'Organize & merchandise',
    blurb: 'Add the product to collections and categories, and choose which sites show it.',
    context: 'All optional — skip and set these up later from the product.',
  },
  review: {
    title: 'Review & publish',
    blurb: 'One last look. Publish to put it on your storefront, or keep it as a draft.',
    context: 'Publishing makes the product live immediately.',
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function dollarsToCents(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100);
}

function toNonNegInt(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
}

function centsToDisplay(cents: number | undefined): string {
  if (cents === undefined) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ProductWizard() {
  return (
    <ModuleProvider module="commerce">
      <ProductWizardInner />
    </ModuleProvider>
  );
}

function ProductWizardInner() {
  const router = useRouter();
  const confirm = useConfirm();

  const [stepKey, setStepKey] = React.useState<StepKey>('basics');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // The draft, once Basics is committed.
  const [productId, setProductId] = React.useState<string | null>(null);
  const [variantId, setVariantId] = React.useState<string | null>(null);
  const [published, setPublished] = React.useState(false);

  // Basics
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [productType, setProductType] = React.useState('');
  const [vendor, setVendor] = React.useState('');
  const [tags, setTags] = React.useState('');
  const [fulfillmentType, setFulfillmentType] = React.useState<FulfillmentType>('physical');
  const [hazmatClass, setHazmatClass] = React.useState<HazmatClass>('none');

  // Pricing
  const [sku, setSku] = React.useState('');
  const [priceStr, setPriceStr] = React.useState('');
  const [compareAtStr, setCompareAtStr] = React.useState('');
  const [costStr, setCostStr] = React.useState('');
  const [taxClass, setTaxClass] = React.useState('');

  // Inventory & shipping
  const [trackInventory, setTrackInventory] = React.useState(true);
  const [warehouses, setWarehouses] = React.useState<WarehouseOption[]>([]);
  const [warehouseId, setWarehouseId] = React.useState('');
  const [quantityStr, setQuantityStr] = React.useState('');
  const [reorderPointStr, setReorderPointStr] = React.useState('');
  const [weightKgStr, setWeightKgStr] = React.useState('');
  const [lengthCmStr, setLengthCmStr] = React.useState('');
  const [widthCmStr, setWidthCmStr] = React.useState('');
  const [heightCmStr, setHeightCmStr] = React.useState('');

  const isPhysical = fulfillmentType === 'physical';

  // Active journey — digital/service skip the physical Inventory step.
  const steps: WizardStepDef[] = React.useMemo(
    () =>
      isPhysical
        ? [
            ALL_STEPS.basics,
            ALL_STEPS.pricing,
            ALL_STEPS.inventory,
            ALL_STEPS.organization,
            ALL_STEPS.review,
          ]
        : [ALL_STEPS.basics, ALL_STEPS.pricing, ALL_STEPS.organization, ALL_STEPS.review],
    [isPhysical]
  );
  const current = Math.max(
    0,
    steps.findIndex((s) => s.key === stepKey)
  );

  // Load warehouses lazily once stock matters.
  React.useEffect(() => {
    if (!isPhysical || warehouses.length > 0) return;
    let cancelled = false;
    void listWarehousesAction().then((res) => {
      if (cancelled || !res.ok) return;
      const rows = res.data.map((w) => ({ id: w.id, code: w.code, name: w.name }));
      setWarehouses(rows);
      const first = rows[0];
      if (first) setWarehouseId((prev) => prev || first.id);
    });
    return () => {
      cancelled = true;
    };
  }, [isPhysical, warehouses.length]);

  function goToStep(key: StepKey) {
    setError(null);
    setStepKey(key);
  }

  function nextKeyAfter(key: StepKey): StepKey {
    const idx = steps.findIndex((s) => s.key === key);
    return (steps[idx + 1]?.key as StepKey | undefined) ?? 'review';
  }

  function prevKeyBefore(key: StepKey): StepKey {
    const idx = steps.findIndex((s) => s.key === key);
    return (steps[idx - 1]?.key as StepKey | undefined) ?? 'basics';
  }

  function tagList(): string[] | undefined {
    const list = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    return list.length > 0 ? list : undefined;
  }

  // ── Basics → create or sync the draft ─────────────────────────────────────────

  async function commitBasics() {
    setSubmitting(true);
    setError(null);
    const input = {
      title: title.trim(),
      // handle is auto-derived from the title by the API when omitted.
      description: description.trim() || undefined,
      status: 'draft' as const,
      productType: productType.trim() || undefined,
      vendor: vendor.trim() || undefined,
      fulfillmentType,
      hazmatClass: isPhysical ? hazmatClass : ('none' as const),
      requiresShipping: isPhysical,
      tags: tagList(),
    };
    try {
      if (!productId) {
        const res = await createProductAction(input);
        if (!res.ok) {
          setError(res.error.message);
          return;
        }
        setProductId(res.data.id);
      } else {
        const res = await updateProductAction(productId, input);
        if (!res.ok) {
          setError(res.error.message);
          return;
        }
      }
      goToStep(nextKeyAfter('basics'));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Pricing → create or sync the default variant ──────────────────────────────

  async function commitPricing() {
    if (!productId) return;
    setSubmitting(true);
    setError(null);
    const priceCents = dollarsToCents(priceStr) ?? 0;
    const compareAtPriceCents = dollarsToCents(compareAtStr);
    const costCents = dollarsToCents(costStr);
    const variantInput = {
      sku: sku.trim(),
      priceCents,
      ...(compareAtPriceCents !== undefined ? { compareAtPriceCents } : {}),
      ...(costCents !== undefined ? { costCents } : {}),
      inventoryPolicy: trackInventory ? ('deny' as const) : ('continue' as const),
      requiresShipping: isPhysical,
      isDefault: true,
      position: 0,
    };
    try {
      // Tax class lives on the product.
      if (taxClass.trim()) {
        const res = await updateProductAction(productId, { taxClass: taxClass.trim() });
        if (!res.ok) {
          setError(res.error.message);
          return;
        }
      }
      if (!variantId) {
        const res = await createVariantAction(productId, variantInput);
        if (!res.ok) {
          setError(res.error.message);
          return;
        }
        setVariantId(res.data.id);
      } else {
        const res = await updateVariantAction(variantId, productId, variantInput);
        if (!res.ok) {
          setError(res.error.message);
          return;
        }
      }
      goToStep(nextKeyAfter('pricing'));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Inventory & shipping → variant dimensions + stock ─────────────────────────

  async function commitInventory() {
    if (!productId || !variantId) return;
    setSubmitting(true);
    setError(null);
    const weightGrams = weightKgStr.trim() ? Math.round(Number(weightKgStr) * 1000) : undefined;
    const lengthMm = lengthCmStr.trim() ? Math.round(Number(lengthCmStr) * 10) : undefined;
    const widthMm = widthCmStr.trim() ? Math.round(Number(widthCmStr) * 10) : undefined;
    const heightMm = heightCmStr.trim() ? Math.round(Number(heightCmStr) * 10) : undefined;
    const dimensions =
      lengthMm && widthMm && heightMm ? { lengthMm, widthMm, heightMm } : undefined;
    try {
      if (weightGrams !== undefined || dimensions) {
        const res = await updateVariantAction(variantId, productId, {
          ...(weightGrams !== undefined ? { weight: weightGrams } : {}),
          ...(dimensions ? { dimensions } : {}),
        });
        if (!res.ok) {
          setError(res.error.message);
          return;
        }
      }

      const qty = toNonNegInt(quantityStr);
      if (trackInventory && warehouseId && qty && qty > 0) {
        const res = await adjustInventoryAction({
          variantId,
          warehouseId,
          delta: qty,
          reason: 'receive',
          note: 'Initial stock — set during product creation',
        });
        if (!res.ok) {
          setError(res.error.message);
          return;
        }
      }

      const reorderPoint = toNonNegInt(reorderPointStr);
      if (trackInventory && warehouseId && reorderPoint !== undefined) {
        const res = await setReorderPolicyAction({
          variantId,
          warehouseId,
          reorderPoint,
        });
        if (!res.ok) {
          setError(res.error.message);
          return;
        }
      }

      goToStep('review');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Review → publish (or finish as draft) ─────────────────────────────────────

  async function finish(publish: boolean) {
    if (!productId) return;
    setSubmitting(true);
    setError(null);
    try {
      if (publish) {
        const res = await publishProductAction(productId);
        if (!res.ok) {
          setError(res.error.message);
          return;
        }
        setPublished(true);
      }
      router.push(`/commerce/products/${productId}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  // ── Cancel / discard ──────────────────────────────────────────────────────────

  async function onCancel() {
    if (submitting) return;
    // Nothing created yet → just leave.
    if (!productId) {
      router.push('/commerce/products');
      return;
    }
    const ok = await confirm({
      title: 'Discard this draft product?',
      description: `“${title.trim() || 'Untitled product'}” was saved as a draft. Discarding deletes it and anything you’ve added.`,
      confirmLabel: 'Discard draft',
      cancelLabel: 'Keep editing',
      tone: 'danger',
    });
    if (!ok) return;
    await deleteProductAction(productId);
    router.push('/commerce/products');
  }

  // ── Step bodies ────────────────────────────────────────────────────────────────

  const basicsStep = (
    <WizardStep
      header={{
        title: 'What are you selling?',
        supporting: 'Name it and tell us how it ships. We’ll save a draft as soon as you continue.',
      }}
      actions={{
        onNext: () => void commitBasics(),
        nextLabel: productId ? 'Save & continue' : 'Create draft & continue',
        nextDisabled: title.trim().length === 0 || submitting,
        nextLoading: submitting,
      }}
    >
      <div className="flex flex-col gap-5">
        <div>
          <Label htmlFor="pw-title">Title</Label>
          <Input
            id="pw-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="6.7L Power Stroke Turbocharger"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="pw-type">Product type</Label>
            <Input
              id="pw-type"
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              placeholder="Auto Part, Apparel, Food…"
            />
          </div>
          <div>
            <Label htmlFor="pw-vendor">Vendor / brand</Label>
            <Input
              id="pw-vendor"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Garrett, Ford…"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="pw-desc">Description</Label>
          <Textarea
            id="pw-desc"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What it is, what it fits, why it’s good."
          />
        </div>
        <div>
          <Label htmlFor="pw-tags">Tags</Label>
          <Input
            id="pw-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="diesel, turbo, oem (comma-separated)"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="pw-fulfillment">Fulfillment</Label>
            <NativeSelect
              id="pw-fulfillment"
              value={fulfillmentType}
              onChange={(e) => setFulfillmentType(e.target.value as FulfillmentType)}
            >
              <option value="physical">Physical goods</option>
              <option value="digital">Digital download</option>
              <option value="service">Service / booking</option>
            </NativeSelect>
          </div>
          {isPhysical && (
            <div>
              <Label htmlFor="pw-hazmat">Hazmat class</Label>
              <NativeSelect
                id="pw-hazmat"
                value={hazmatClass}
                onChange={(e) => setHazmatClass(e.target.value as HazmatClass)}
              >
                <option value="none">None</option>
                <option value="flammable_liquid">Flammable liquid</option>
                <option value="flammable_solid">Flammable solid</option>
                <option value="gas">Compressed gas</option>
                <option value="oxidizer">Oxidizer</option>
                <option value="toxic">Toxic</option>
                <option value="corrosive">Corrosive</option>
                <option value="radioactive">Radioactive</option>
                <option value="misc">Miscellaneous</option>
              </NativeSelect>
            </div>
          )}
        </div>
        {error && (
          <Text size="sm" variant="danger" role="alert">
            {error}
          </Text>
        )}
      </div>
    </WizardStep>
  );

  const pricingStep = (
    <WizardStep
      header={{
        title: 'Price it',
        supporting:
          'This sets up the default variant. The cost is private — it powers your margins.',
      }}
      actions={{
        onBack: () => goToStep(prevKeyBefore('pricing')),
        onNext: () => void commitPricing(),
        nextLabel: 'Save & continue',
        nextDisabled:
          sku.trim().length === 0 || dollarsToCents(priceStr) === undefined || submitting,
        nextLoading: submitting,
      }}
    >
      <div className="flex flex-col gap-5">
        <div>
          <Label htmlFor="pw-sku">SKU</Label>
          <Input
            id="pw-sku"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="GAR-6.7-TURBO"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="pw-price">Price (USD)</Label>
            <Input
              id="pw-price"
              inputMode="decimal"
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
              placeholder="1299.00"
            />
          </div>
          <div>
            <Label htmlFor="pw-compare">Compare at</Label>
            <Input
              id="pw-compare"
              inputMode="decimal"
              value={compareAtStr}
              onChange={(e) => setCompareAtStr(e.target.value)}
              placeholder="1499.00"
            />
          </div>
          <div>
            <Label htmlFor="pw-cost">Cost</Label>
            <Input
              id="pw-cost"
              inputMode="decimal"
              value={costStr}
              onChange={(e) => setCostStr(e.target.value)}
              placeholder="900.00"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="pw-tax">Tax class</Label>
          <Input
            id="pw-tax"
            value={taxClass}
            onChange={(e) => setTaxClass(e.target.value)}
            placeholder="standard | food | digital | apparel"
          />
        </div>
        {error && (
          <Text size="sm" variant="danger" role="alert">
            {error}
          </Text>
        )}
      </div>
    </WizardStep>
  );

  const inventoryStep = (
    <WizardStep
      header={{
        title: 'Stock & shipping',
        supporting: 'Seed initial stock and give the carrier the weight and dimensions.',
      }}
      actions={{
        onBack: () => goToStep(prevKeyBefore('inventory')),
        onNext: () => void commitInventory(),
        onSkip: () => goToStep('review'),
        nextLabel: 'Save & continue',
        nextLoading: submitting,
        nextDisabled: submitting,
      }}
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--color-border-default)] p-4">
          <span className="flex flex-col gap-0.5">
            <Text size="sm" weight="medium">
              Track inventory
            </Text>
            <Text size="sm" variant="muted">
              Count stock and stop selling at zero. Turn off to always allow purchase.
            </Text>
          </span>
          <Switch
            checked={trackInventory}
            onCheckedChange={setTrackInventory}
            aria-label="Track inventory"
          />
        </div>

        {trackInventory && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="pw-warehouse">Warehouse</Label>
              <NativeSelect
                id="pw-warehouse"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                disabled={warehouses.length === 0}
              >
                {warehouses.length === 0 ? (
                  <option value="">No warehouses yet</option>
                ) : (
                  warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))
                )}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="pw-qty">On hand</Label>
              <Input
                id="pw-qty"
                inputMode="numeric"
                value={quantityStr}
                onChange={(e) => setQuantityStr(e.target.value)}
                placeholder="25"
              />
            </div>
            <div>
              <Label htmlFor="pw-reorder">Reorder at</Label>
              <Input
                id="pw-reorder"
                inputMode="numeric"
                value={reorderPointStr}
                onChange={(e) => setReorderPointStr(e.target.value)}
                placeholder="5"
              />
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="pw-weight">Shipping weight (kg)</Label>
          <Input
            id="pw-weight"
            inputMode="decimal"
            value={weightKgStr}
            onChange={(e) => setWeightKgStr(e.target.value)}
            placeholder="8.5"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="pw-length">Length (cm)</Label>
            <Input
              id="pw-length"
              inputMode="decimal"
              value={lengthCmStr}
              onChange={(e) => setLengthCmStr(e.target.value)}
              placeholder="30"
            />
          </div>
          <div>
            <Label htmlFor="pw-width">Width (cm)</Label>
            <Input
              id="pw-width"
              inputMode="decimal"
              value={widthCmStr}
              onChange={(e) => setWidthCmStr(e.target.value)}
              placeholder="30"
            />
          </div>
          <div>
            <Label htmlFor="pw-height">Height (cm)</Label>
            <Input
              id="pw-height"
              inputMode="decimal"
              value={heightCmStr}
              onChange={(e) => setHeightCmStr(e.target.value)}
              placeholder="25"
            />
          </div>
        </div>
        {error && (
          <Text size="sm" variant="danger" role="alert">
            {error}
          </Text>
        )}
      </div>
    </WizardStep>
  );

  const reviewStep = (
    <WizardStep
      header={{
        title: 'Review & publish',
        supporting:
          'Confirm the essentials. You can keep enriching the product from its detail tabs.',
      }}
      actions={{
        onBack: () => goToStep(prevKeyBefore('review')),
        onNext: () => void finish(true),
        nextLabel: 'Publish product',
        nextLoading: submitting,
        nextDisabled: submitting,
        extra: (
          <Button variant="outline" onClick={() => void finish(false)} disabled={submitting}>
            Save as draft
          </Button>
        ),
      }}
    >
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-2.5 text-sm">
          <dt className="text-[var(--color-text-muted)]">Title</dt>
          <dd className="font-medium">{title.trim() || '—'}</dd>
          <dt className="text-[var(--color-text-muted)]">Type</dt>
          <dd className="font-medium">
            {fulfillmentType}
            {productType.trim() ? ` · ${productType.trim()}` : ''}
          </dd>
          <dt className="text-[var(--color-text-muted)]">SKU</dt>
          <dd className="font-medium">{sku.trim() || '—'}</dd>
          <dt className="text-[var(--color-text-muted)]">Price</dt>
          <dd className="font-medium">
            {centsToDisplay(dollarsToCents(priceStr))}
            {dollarsToCents(compareAtStr) !== undefined && (
              <span className="ml-2 text-[var(--color-text-muted)] line-through">
                {centsToDisplay(dollarsToCents(compareAtStr))}
              </span>
            )}
          </dd>
          {isPhysical && trackInventory && (
            <>
              <dt className="text-[var(--color-text-muted)]">Initial stock</dt>
              <dd className="font-medium">
                {toNonNegInt(quantityStr) ?? 0}
                {warehouses.find((w) => w.id === warehouseId)
                  ? ` @ ${warehouses.find((w) => w.id === warehouseId)?.code}`
                  : ''}
              </dd>
            </>
          )}
        </dl>

        <div className="rounded-xl border border-[var(--color-border-default)] p-4">
          <Text size="sm" variant="muted">
            Next, from the product’s tabs you can add{' '}
            <span className="text-[var(--color-text-primary)]">variants &amp; options</span>,{' '}
            <span className="text-[var(--color-text-primary)]">media</span>, and{' '}
            <span className="text-[var(--color-text-primary)]">fitment</span>. These become guided
            steps here as the wizard is completed.
          </Text>
        </div>

        {error && (
          <Text size="sm" variant="danger" role="alert">
            {error}
          </Text>
        )}
      </div>
    </WizardStep>
  );

  let body: React.ReactNode;
  if (stepKey === 'basics') body = basicsStep;
  else if (stepKey === 'pricing') body = pricingStep;
  else if (stepKey === 'inventory') body = inventoryStep;
  else if (stepKey === 'organization' && productId)
    body = (
      <OrganizationStep
        productId={productId}
        onBack={() => goToStep(prevKeyBefore('organization'))}
        onComplete={() => goToStep('review')}
      />
    );
  else body = reviewStep;

  return (
    <WizardFrame
      variant="page"
      // The /new route lives under the dashboard layout; render the page-variant
      // frame as a full-screen overlay so it covers the sidebar/topbar chrome
      // rather than nesting a second rail beside it.
      className="fixed inset-0 z-50"
      lede={{ title: RAIL[stepKey].title, blurb: RAIL[stepKey].blurb }}
      steps={steps}
      current={current}
      context={
        published ? (
          <Badge color="success" variant="soft" size="sm">
            Published
          </Badge>
        ) : (
          RAIL[stepKey].context
        )
      }
      onStepSelect={(key) => {
        const target = steps.findIndex((s) => s.key === key);
        if (target >= 0 && target <= current) goToStep(key as StepKey);
      }}
      canSelectStep={(_key, index) => index <= current}
      footer={
        <button
          type="button"
          onClick={() => void onCancel()}
          className="text-white/70 underline-offset-2 hover:underline"
        >
          Cancel
        </button>
      }
    >
      {body}
    </WizardFrame>
  );
}
