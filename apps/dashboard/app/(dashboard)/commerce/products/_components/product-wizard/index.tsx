'use client';

// Product creation wizard (docs/68 B-1, docs/86 SurfaceFrame).
//
// The comprehensive guided flow for adding a catalog product and walking the
// merchant through its relations, on the platform's full-page SurfaceFrame.
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
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  NativeSelect,
  Switch,
  Textarea,
} from '@wizeworks/silicaui-react';
import {
  ModuleProvider,
  SurfaceFrame,
  SurfaceStep,
  SurfaceSummary,
  SurfaceSummaryDivider,
  SurfaceSummaryRow,
  useConfirm,
  type SurfaceStepDef,
} from '@sparx/ui';
import { rule, useFieldValidation } from '@sparx/forms';

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
} from '../../../../inventory/_lib/inventory-actions';
import { listFitmentDomainsAction } from '../../../fitment-actions';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';
import { OrganizationStep } from './organization-step';
import { VariantsStep } from './variants-step';
import { MediaStep } from './media-step';
import { FitmentStep } from './fitment-step';
import { InlineWarehouseCreate } from './inline-warehouse-create';

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

const FULFILLMENT_LABEL: Record<FulfillmentType, string> = {
  physical: 'Physical goods',
  digital: 'Digital download',
  service: 'Service / booking',
};

type StepKey =
  | 'basics'
  | 'pricing'
  | 'variants'
  | 'media'
  | 'fitment'
  | 'inventory'
  | 'organization'
  | 'review';

const ALL_STEPS: Record<StepKey, SurfaceStepDef> = {
  basics: { key: 'basics', label: 'Basics', sublabel: 'Name & type' },
  pricing: { key: 'pricing', label: 'Pricing', sublabel: 'Price & tax' },
  variants: { key: 'variants', label: 'Variants', sublabel: 'Options & SKUs' },
  media: { key: 'media', label: 'Photos', sublabel: 'Images & hero' },
  fitment: { key: 'fitment', label: 'Fitment', sublabel: 'Compatibility' },
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
    context: 'This creates the default variant — add options & more variants next.',
  },
  variants: {
    title: 'Variants & options',
    blurb: 'Sell variations — Size, Color, Material. Generate a SKU for every combination at once.',
    context: 'Optional — skip for a single-SKU product.',
  },
  media: {
    title: 'Photos',
    blurb: 'Add product images and star the one that represents it best.',
    context: 'Optional — add photos now or anytime from the product.',
  },
  fitment: {
    title: 'Fitment & compatibility',
    blurb:
      'List what this product fits or works with — vehicles, devices, breeds, whatever applies.',
    context: 'Optional — add as many fits as you need.',
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

// Field rules for the numeric inputs (@sparx/forms has no number builder yet).
// Required money: reject empty, NaN, and negative.
function requiredMoneyRule(val: string): string | null {
  const s = val.trim();
  if (s === '') return 'Enter a price.';
  const n = Number(s);
  if (!Number.isFinite(n)) return 'Enter a valid number.';
  if (n < 0) return 'Cannot be negative.';
  return null;
}
// Optional numeric: empty is allowed; otherwise reject NaN and negative.
function optionalNonNegativeRule(val: string): string | null {
  const s = val.trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return 'Enter a valid number.';
  if (n < 0) return 'Cannot be negative.';
  return null;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export interface ProductWizardProps {
  /** How the wizard is presented:
   *   • `'page'`    — the `/new` route; the in-app `embedded` top-stepper that
   *                   fills the dashboard content area (sidebar + header stay).
   *   • `'overlay'` — hosted inside the dashboard's drawer/modal detail chrome
   *                   (docs/86 `SurfaceFrame` inline variant). The user's
   *                   `defaultDetailView` preference picks drawer vs. modal;
   *                   the chrome supplies the shell + close/switch/maximize
   *                   header, and the wizard fills the body. */
  presentation?: 'page' | 'overlay';
}

export function ProductWizard(props: ProductWizardProps = {}) {
  // Both presentations are full-height top-stepper frames (embedded fills the
  // dashboard content area; inline fills the drawer/modal body), so the wrapping
  // ModuleProvider div carries the height through (h-full).
  return (
    <ModuleProvider module="commerce" className="h-full">
      <ProductWizardInner {...props} />
    </ModuleProvider>
  );
}

function ProductWizardInner({ presentation = 'page' }: ProductWizardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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

  // Per-step field validation — three independent hooks so each step's validate()
  // stays scoped to just that step's fields (the wizard commits step by step).
  const vBasics = useFieldValidation({ title }, { title: rule.required('Enter a product title.') });
  const vPricing = useFieldValidation(
    { sku, priceStr, compareAtStr, costStr },
    {
      sku: rule.required('Enter a SKU.'),
      priceStr: requiredMoneyRule,
      compareAtStr: optionalNonNegativeRule,
      costStr: optionalNonNegativeRule,
    }
  );
  const vInventory = useFieldValidation(
    { quantityStr, reorderPointStr, weightKgStr, lengthCmStr, widthCmStr, heightCmStr },
    {
      quantityStr: optionalNonNegativeRule,
      reorderPointStr: optionalNonNegativeRule,
      weightKgStr: optionalNonNegativeRule,
      lengthCmStr: optionalNonNegativeRule,
      widthCmStr: optionalNonNegativeRule,
      heightCmStr: optionalNonNegativeRule,
    }
  );

  // Unsaved-changes guard. This wizard creates a real DRAFT product the moment
  // Basics is committed, and `onCancel` already confirms discarding that draft —
  // so the guard only needs to cover the window BEFORE the draft exists: anything
  // typed in Basics (or the fulfillment default moved) with no product id yet.
  // Scoping `dirty` to that window means the guard's confirm never stacks with
  // the draft-discard confirm, while still registering the guard so the overlay
  // host's Close / Switch / backdrop consult it for un-committed typed work.
  const dirty =
    !productId &&
    (title.trim() !== '' ||
      description.trim() !== '' ||
      productType.trim() !== '' ||
      vendor.trim() !== '' ||
      tags.trim() !== '' ||
      fulfillmentType !== 'physical');
  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'product' });

  // Fitment is generalized (vehicle / device / breed …) but only meaningful when
  // the tenant has actually set up fitment data — a domain with values. We gate
  // the step on that so a plain content/apparel tenant never sees it.
  const [fitmentRelevant, setFitmentRelevant] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    void listFitmentDomainsAction().then((res) => {
      if (cancelled || !res.ok) return;
      setFitmentRelevant(res.data.some((d) => d.rootCount > 0));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Active journey — digital/service skip the physical Inventory step; Fitment
  // only appears when the tenant uses it.
  const steps: SurfaceStepDef[] = React.useMemo(() => {
    const journey: SurfaceStepDef[] = [
      ALL_STEPS.basics,
      ALL_STEPS.pricing,
      ALL_STEPS.variants,
      ALL_STEPS.media,
    ];
    if (fitmentRelevant) journey.push(ALL_STEPS.fitment);
    if (isPhysical) journey.push(ALL_STEPS.inventory);
    journey.push(ALL_STEPS.organization, ALL_STEPS.review);
    return journey;
  }, [isPhysical, fitmentRelevant]);
  const current = Math.max(
    0,
    steps.findIndex((s) => s.key === stepKey)
  );

  // Refresh the warehouse list. `selectId` pins the selection (used after an
  // inline create); otherwise the first warehouse is selected if none is yet.
  const refreshWarehouses = React.useCallback(async (selectId?: string) => {
    const res = await listWarehousesAction();
    if (!res.ok) return;
    const rows = res.data.map((w) => ({ id: w.id, code: w.code, name: w.name }));
    setWarehouses(rows);
    if (selectId) setWarehouseId(selectId);
    else setWarehouseId((prev) => (prev ? prev : (rows[0]?.id ?? '')));
  }, []);

  // Load warehouses lazily once stock matters.
  React.useEffect(() => {
    if (!isPhysical || warehouses.length > 0) return;
    void refreshWarehouses();
  }, [isPhysical, warehouses.length, refreshWarehouses]);

  function goToStep(key: StepKey) {
    setError(null);
    setStepKey(key);
  }

  // Where "leave the wizard" goes. In the overlay it clears the detail token so
  // the drawer/modal closes in place (the list stays mounted behind it); the
  // full-page route navigates back to the list.
  const close = React.useCallback(() => {
    if (presentation === 'overlay') {
      const next = new URLSearchParams(searchParams?.toString() ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/commerce/products');
    }
  }, [presentation, pathname, searchParams, router]);

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
    if (!vBasics.validate()) {
      setSubmitting(false);
      return;
    }
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
    if (!vPricing.validate()) {
      setSubmitting(false);
      return;
    }
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
    if (!vInventory.validate()) {
      setSubmitting(false);
      return;
    }
    const weightGrams = weightKgStr.trim() ? Math.round(Number(weightKgStr) * 1000) : undefined;
    const lengthMm = lengthCmStr.trim() ? Math.round(Number(lengthCmStr) * 10) : undefined;
    const widthMm = widthCmStr.trim() ? Math.round(Number(widthCmStr) * 10) : undefined;
    const heightMm = heightCmStr.trim() ? Math.round(Number(heightCmStr) * 10) : undefined;
    const dimensions =
      lengthMm && widthMm && heightMm ? { lengthMm, widthMm, heightMm } : undefined;
    try {
      // Hazmat / shipping classification lives on the product and is authored on
      // this (physical-only) step now, so sync it here.
      const hazmatRes = await updateProductAction(productId, { hazmatClass });
      if (!hazmatRes.ok) {
        setError(hazmatRes.error.message);
        return;
      }

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
          // The wizard only asks for the trigger point; seed a sensible reorder
          // quantity (the schema requires a positive value) the merchant tunes later.
          reorderQuantity: Math.max(reorderPoint, 1),
        });
        if (!res.ok) {
          setError(res.error.message);
          return;
        }
      }

      goToStep(nextKeyAfter('inventory'));
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
      // Created → go view the product. Navigating away clears the overlay token,
      // so the drawer/modal closes on its own.
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
      close();
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
    close();
  }

  // Frame-owned Cancel: consult the unsaved-changes guard first (it confirms a
  // discard when anything's been entered), then run the leave/draft-cleanup path.
  const guardedCancel = React.useCallback(async () => {
    if (await guardLeave()) void onCancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onCancel is a stable function declaration
  }, [guardLeave]);

  // ── Step bodies ────────────────────────────────────────────────────────────────

  const basicsStep = (
    <SurfaceStep
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
      <Card>
        <CardBody className="py-6">
          <div className="flex flex-col gap-5">
            <Field {...vBasics.field('title')}>
              <FieldLabel required>Title</FieldLabel>
              <FieldControl
                id="pw-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What you're selling"
                {...vBasics.control('title')}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Product type</FieldLabel>
                <FieldControl
                  id="pw-type"
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  placeholder="e.g. Apparel, Book, Tool"
                />
              </Field>
              <Field>
                <FieldLabel>Vendor / brand</FieldLabel>
                <FieldControl
                  id="pw-vendor"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="Brand or supplier"
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Description</FieldLabel>
              <FieldControl
                id="pw-desc"
                render={<Textarea rows={4} />}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What it is and why someone wants it."
              />
            </Field>
            <Field>
              <FieldLabel>Tags</FieldLabel>
              <FieldControl
                id="pw-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. featured, sale, new (comma-separated)"
              />
            </Field>
            <Field>
              <FieldLabel>Fulfillment</FieldLabel>
              <NativeSelect
                id="pw-fulfillment"
                value={fulfillmentType}
                onChange={(e) => setFulfillmentType(e.target.value as FulfillmentType)}
              >
                <option value="physical">Physical goods</option>
                <option value="digital">Digital download</option>
                <option value="service">Service / booking</option>
              </NativeSelect>
              <FieldDescription>
                Physical ships and tracks stock. Digital and service skip shipping.
              </FieldDescription>
            </Field>
            {error && (
              <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                {error}
              </FieldStatus>
            )}
          </div>
        </CardBody>
      </Card>
    </SurfaceStep>
  );

  const pricingStep = (
    <SurfaceStep
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
      <Card>
        <CardBody className="py-6">
          <div className="flex flex-col gap-5">
            <Field {...vPricing.field('sku')}>
              <FieldLabel required>SKU</FieldLabel>
              <FieldControl
                id="pw-sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="SKU-001"
                {...vPricing.control('sku')}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field {...vPricing.field('priceStr')}>
                <FieldLabel required>Price (USD)</FieldLabel>
                <FieldControl
                  id="pw-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceStr}
                  onChange={(e) => setPriceStr(e.target.value)}
                  placeholder="29.00"
                  {...vPricing.control('priceStr')}
                />
              </Field>
              <Field {...vPricing.field('compareAtStr')}>
                <FieldLabel>Compare at</FieldLabel>
                <FieldControl
                  id="pw-compare"
                  type="number"
                  min="0"
                  step="0.01"
                  value={compareAtStr}
                  onChange={(e) => setCompareAtStr(e.target.value)}
                  placeholder="39.00"
                  {...vPricing.control('compareAtStr')}
                />
              </Field>
              <Field {...vPricing.field('costStr')}>
                <FieldLabel>Cost</FieldLabel>
                <FieldControl
                  id="pw-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={costStr}
                  onChange={(e) => setCostStr(e.target.value)}
                  placeholder="12.00"
                  {...vPricing.control('costStr')}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Tax class</FieldLabel>
              <FieldControl
                id="pw-tax"
                value={taxClass}
                onChange={(e) => setTaxClass(e.target.value)}
                placeholder="standard | food | digital | apparel"
              />
            </Field>
            {error && (
              <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                {error}
              </FieldStatus>
            )}
          </div>
        </CardBody>
      </Card>
    </SurfaceStep>
  );

  const inventoryStep = (
    <SurfaceStep
      header={{
        title: 'Stock & shipping',
        supporting: 'Seed initial stock and give the carrier the weight and dimensions.',
      }}
      actions={{
        onBack: () => goToStep(prevKeyBefore('inventory')),
        onNext: () => void commitInventory(),
        onSkip: () => goToStep(nextKeyAfter('inventory')),
        nextLabel: 'Save & continue',
        nextLoading: submitting,
        nextDisabled: submitting,
      }}
    >
      <Card>
        <CardBody className="py-6">
          <div className="flex flex-col gap-5">
            <div className="border-base-300 flex items-start justify-between gap-4 rounded-xl border p-4">
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Track inventory</span>
                <span className="text-base-content/70 text-sm">
                  Count stock and stop selling at zero. Turn off to always allow purchase.
                </span>
              </span>
              <Switch
                checked={trackInventory}
                onCheckedChange={setTrackInventory}
                aria-label="Track inventory"
              />
            </div>

            {trackInventory && (
              <div className="flex flex-col gap-3">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field>
                    <FieldLabel>Warehouse</FieldLabel>
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
                  </Field>
                  <Field {...vInventory.field('quantityStr')}>
                    <FieldLabel>On hand</FieldLabel>
                    <FieldControl
                      id="pw-qty"
                      type="number"
                      min="0"
                      step="1"
                      value={quantityStr}
                      onChange={(e) => setQuantityStr(e.target.value)}
                      placeholder="25"
                      disabled={warehouses.length === 0}
                      {...vInventory.control('quantityStr')}
                    />
                  </Field>
                  <Field {...vInventory.field('reorderPointStr')}>
                    <FieldLabel>Reorder at</FieldLabel>
                    <FieldControl
                      id="pw-reorder"
                      type="number"
                      min="0"
                      step="1"
                      value={reorderPointStr}
                      onChange={(e) => setReorderPointStr(e.target.value)}
                      placeholder="5"
                      disabled={warehouses.length === 0}
                      {...vInventory.control('reorderPointStr')}
                    />
                  </Field>
                </div>
                {warehouses.length === 0 && (
                  <p className="text-base-content/70 text-sm">
                    No warehouse yet — create one here to seed stock without leaving the wizard.
                  </p>
                )}
                <InlineWarehouseCreate onCreated={(id) => refreshWarehouses(id)} />
              </div>
            )}

            <Field {...vInventory.field('weightKgStr')}>
              <FieldLabel>Shipping weight (kg)</FieldLabel>
              <FieldControl
                id="pw-weight"
                type="number"
                min="0"
                step="0.01"
                value={weightKgStr}
                onChange={(e) => setWeightKgStr(e.target.value)}
                placeholder="8.5"
                {...vInventory.control('weightKgStr')}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field {...vInventory.field('lengthCmStr')}>
                <FieldLabel>Length (cm)</FieldLabel>
                <FieldControl
                  id="pw-length"
                  type="number"
                  min="0"
                  step="0.01"
                  value={lengthCmStr}
                  onChange={(e) => setLengthCmStr(e.target.value)}
                  placeholder="30"
                  {...vInventory.control('lengthCmStr')}
                />
              </Field>
              <Field {...vInventory.field('widthCmStr')}>
                <FieldLabel>Width (cm)</FieldLabel>
                <FieldControl
                  id="pw-width"
                  type="number"
                  min="0"
                  step="0.01"
                  value={widthCmStr}
                  onChange={(e) => setWidthCmStr(e.target.value)}
                  placeholder="30"
                  {...vInventory.control('widthCmStr')}
                />
              </Field>
              <Field {...vInventory.field('heightCmStr')}>
                <FieldLabel>Height (cm)</FieldLabel>
                <FieldControl
                  id="pw-height"
                  type="number"
                  min="0"
                  step="0.01"
                  value={heightCmStr}
                  onChange={(e) => setHeightCmStr(e.target.value)}
                  placeholder="25"
                  {...vInventory.control('heightCmStr')}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Shipping classification</FieldLabel>
              <NativeSelect
                id="pw-hazmat"
                value={hazmatClass}
                onChange={(e) => setHazmatClass(e.target.value as HazmatClass)}
              >
                <option value="none">Standard — no special handling</option>
                <option value="flammable_liquid">Flammable liquid</option>
                <option value="flammable_solid">Flammable solid</option>
                <option value="gas">Compressed gas</option>
                <option value="oxidizer">Oxidizer</option>
                <option value="toxic">Toxic</option>
                <option value="corrosive">Corrosive</option>
                <option value="radioactive">Radioactive</option>
                <option value="misc">Other regulated</option>
              </NativeSelect>
              <FieldDescription>
                Most products are Standard. Set this only for regulated goods (batteries, aerosols,
                chemicals) so carriers route them correctly.
              </FieldDescription>
            </Field>
            {error && (
              <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                {error}
              </FieldStatus>
            )}
          </div>
        </CardBody>
      </Card>
    </SurfaceStep>
  );

  const reviewStep = (
    <SurfaceStep
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
      <Card>
        <CardBody className="py-6">
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-2.5 text-sm">
              <dt className="text-base-content/60">Title</dt>
              <dd className="font-medium">{title.trim() || '—'}</dd>
              <dt className="text-base-content/60">Type</dt>
              <dd className="font-medium">
                {fulfillmentType}
                {productType.trim() ? ` · ${productType.trim()}` : ''}
              </dd>
              <dt className="text-base-content/60">SKU</dt>
              <dd className="font-medium">{sku.trim() || '—'}</dd>
              <dt className="text-base-content/60">Price</dt>
              <dd className="font-medium">
                {centsToDisplay(dollarsToCents(priceStr))}
                {dollarsToCents(compareAtStr) !== undefined && (
                  <span className="text-base-content/60 ml-2 line-through">
                    {centsToDisplay(dollarsToCents(compareAtStr))}
                  </span>
                )}
              </dd>
              {isPhysical && trackInventory && (
                <>
                  <dt className="text-base-content/60">Initial stock</dt>
                  <dd className="font-medium">
                    {toNonNegInt(quantityStr) ?? 0}
                    {warehouses.find((w) => w.id === warehouseId)
                      ? ` @ ${warehouses.find((w) => w.id === warehouseId)?.code}`
                      : ''}
                  </dd>
                </>
              )}
            </dl>

            <div className="border-base-300 rounded-xl border p-4">
              <p className="text-base-content/70 text-sm">
                Next, from the product’s tabs you can add{' '}
                <span className="text-base-content">variants &amp; options</span>,{' '}
                <span className="text-base-content">media</span>, and{' '}
                <span className="text-base-content">fitment</span>. These become guided steps here
                as the wizard is completed.
              </p>
            </div>

            {error && (
              <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                {error}
              </FieldStatus>
            )}
          </div>
        </CardBody>
      </Card>
    </SurfaceStep>
  );

  let body: React.ReactNode;
  if (stepKey === 'basics') body = basicsStep;
  else if (stepKey === 'pricing') body = pricingStep;
  else if (stepKey === 'variants' && productId)
    body = (
      <VariantsStep
        productId={productId}
        productTitle={title.trim() || 'Untitled product'}
        requiresShipping={isPhysical}
        onBack={() => goToStep(prevKeyBefore('variants'))}
        onComplete={() => goToStep(nextKeyAfter('variants'))}
      />
    );
  else if (stepKey === 'media' && productId)
    body = (
      <MediaStep
        productId={productId}
        onBack={() => goToStep(prevKeyBefore('media'))}
        onComplete={() => goToStep(nextKeyAfter('media'))}
      />
    );
  else if (stepKey === 'fitment' && productId)
    body = (
      <FitmentStep
        productId={productId}
        onBack={() => goToStep(prevKeyBefore('fitment'))}
        onComplete={() => goToStep(nextKeyAfter('fitment'))}
      />
    );
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

  // Rail/journey props shared by both presentations — the colored rail, the
  // step list, the per-step context card, and the click-to-revisit behavior are
  // identical; only the frame around them (full-page overlay vs. dialog) differs.
  const railContext = published ? (
    <Badge color="success" variant="soft" size="sm">
      Published
    </Badge>
  ) : (
    RAIL[stepKey].context
  );
  const onStepSelect = (key: string) => {
    const target = steps.findIndex((s) => s.key === key);
    if (target >= 0 && target <= current) goToStep(key as StepKey);
  };
  const canSelectStep = (_key: string, index: number) => index <= current;

  // The live draft summary — the F layout's right-hand column (docs/86). Builds as
  // the merchant fills the spine; the right column earns the modal's width instead
  // of leaving it empty.
  const summary = (
    <SurfaceSummary
      title="Draft summary"
      footer={
        <Badge color={published ? 'success' : 'module'} variant="soft" size="sm">
          {published ? 'Published' : 'Draft — editable after create'}
        </Badge>
      }
    >
      <SurfaceSummaryRow label="Title" value={title.trim() || '—'} />
      <SurfaceSummaryRow label="Format" value={FULFILLMENT_LABEL[fulfillmentType]} />
      {productType.trim() && <SurfaceSummaryRow label="Type" value={productType.trim()} />}
      <SurfaceSummaryRow label="SKU" value={sku.trim() || '—'} />
      <SurfaceSummaryDivider />
      <SurfaceSummaryRow label="Price" value={centsToDisplay(dollarsToCents(priceStr))} strong />
      {dollarsToCents(compareAtStr) !== undefined && (
        <SurfaceSummaryRow
          label="Compare at"
          value={centsToDisplay(dollarsToCents(compareAtStr))}
        />
      )}
      {isPhysical && trackInventory && (
        <SurfaceSummaryRow label="On hand" value={String(toNonNegInt(quantityStr) ?? 0)} />
      )}
    </SurfaceSummary>
  );

  // One top-stepper frame for both presentations: `embedded` fills the dashboard
  // content area at the `/new` route (sidebar + header stay); `inline` fills the
  // drawer/modal detail panel, which supplies its own close/switch/maximize chrome.
  return (
    <SurfaceFrame
      variant={presentation === 'overlay' ? 'inline' : 'embedded'}
      title="New product"
      steps={steps}
      current={current}
      context={railContext}
      onStepSelect={onStepSelect}
      canSelectStep={canSelectStep}
      onCancel={() => void guardedCancel()}
      summary={summary}
    >
      {body}
    </SurfaceFrame>
  );
}
