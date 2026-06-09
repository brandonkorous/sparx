'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button, Heading, Stack, Stepper, Text } from '@sparx/ui';

import { createProductWithVariantAction } from '../../../product-actions';
import { StepBasics, type BasicsData } from './step-basics';
import { StepInventory, type InventoryData } from './step-inventory';
import { StepPricing, type PricingData } from './step-pricing';
import { StepReview } from './step-review';

// Product creation wizard (docs/69 Phase B-1).
// Replaces the flat ProductCreateForm for both the overlay (drawer/modal) and
// the full-page /new route. Captures Basics → Pricing → Inventory (physical
// only) → Review, then creates the product + default variant in one action.

export interface ProductWizardProps {
  surface: 'page' | 'overlay';
}

const STEPS_PHYSICAL = [
  { label: 'Basics' },
  { label: 'Pricing' },
  { label: 'Inventory' },
  { label: 'Review' },
];
const STEPS_SIMPLE = [{ label: 'Basics' }, { label: 'Pricing' }, { label: 'Review' }];

const INITIAL_BASICS: BasicsData = {
  title: '',
  sku: '',
  fulfillmentType: 'physical',
};
const INITIAL_PRICING: PricingData = { priceStr: '', compareAtStr: '', taxClass: '' };
const INITIAL_INVENTORY: InventoryData = {
  trackInventory: true,
  quantityStr: '',
  lowStockStr: '',
  weightKgStr: '',
  lengthCmStr: '',
  widthCmStr: '',
  heightCmStr: '',
};

export function ProductWizard({ surface }: ProductWizardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [step, setStep] = React.useState(0);
  const [basics, setBasics] = React.useState<BasicsData>(INITIAL_BASICS);
  const [pricing, setPricing] = React.useState<PricingData>(INITIAL_PRICING);
  const [inventory, setInventory] = React.useState<InventoryData>(INITIAL_INVENTORY);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const isPhysical = basics.fulfillmentType === 'physical';
  const steps = isPhysical ? STEPS_PHYSICAL : STEPS_SIMPLE;
  const totalSteps = steps.length;
  const _isLastStep = step === totalSteps - 1;

  // Map wizard step index → logical step name.
  // Physical: 0=basics 1=pricing 2=inventory 3=review
  // Simple:   0=basics 1=pricing 2=review
  const stepName: 'basics' | 'pricing' | 'inventory' | 'review' = (() => {
    if (step === 0) return 'basics';
    if (step === 1) return 'pricing';
    if (isPhysical && step === 2) return 'inventory';
    return 'review';
  })();

  // ── Validation ──────────────────────────────────────────────────────────

  function validateStep(): boolean {
    const errs: Record<string, string> = {};

    if (stepName === 'basics') {
      if (!basics.title.trim()) errs.title = 'Product name is required.';
      if (!basics.sku.trim()) {
        errs.sku = 'SKU is required.';
      } else if (!/^[a-zA-Z0-9_\-./]+$/.test(basics.sku.trim())) {
        errs.sku =
          'SKU may only contain letters, numbers, hyphens, underscores, periods, or slashes.';
      }
    }

    if (stepName === 'pricing') {
      const price = parseFloat(pricing.priceStr);
      if (!pricing.priceStr || Number.isNaN(price) || price < 0) {
        errs.price = 'Enter a valid price (e.g. 19.99).';
      }
      if (pricing.compareAtStr) {
        const compareAt = parseFloat(pricing.compareAtStr);
        if (Number.isNaN(compareAt) || compareAt < 0) {
          errs.compareAt = 'Enter a valid compare-at price or leave it blank.';
        }
      }
    }

    if (stepName === 'inventory') {
      if (inventory.trackInventory && inventory.quantityStr) {
        const qty = parseInt(inventory.quantityStr, 10);
        if (Number.isNaN(qty) || qty < 0) errs.quantity = 'Enter a whole number ≥ 0.';
      }
      if (inventory.trackInventory && inventory.lowStockStr) {
        const ls = parseInt(inventory.lowStockStr, 10);
        if (Number.isNaN(ls) || ls < 0) errs.lowStock = 'Enter a whole number ≥ 0.';
      }
      if (inventory.weightKgStr) {
        const w = parseFloat(inventory.weightKgStr);
        if (Number.isNaN(w) || w <= 0) errs.weight = 'Enter a positive weight in kg.';
      }
      // Dimensions: if any are filled, all must be positive
      const hasDim = inventory.lengthCmStr || inventory.widthCmStr || inventory.heightCmStr;
      if (hasDim) {
        const l = parseFloat(inventory.lengthCmStr);
        const w = parseFloat(inventory.widthCmStr);
        const h = parseFloat(inventory.heightCmStr);
        if (Number.isNaN(l) || Number.isNaN(w) || Number.isNaN(h) || l <= 0 || w <= 0 || h <= 0) {
          errs.dimensions = 'Enter all three dimensions as positive numbers.';
        }
      }
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Navigation ──────────────────────────────────────────────────────────

  function goNext() {
    if (!validateStep()) return;
    setFieldErrors({});
    setStep((s) => s + 1);
  }

  function goBack() {
    setFieldErrors({});
    setError(null);
    setStep((s) => s - 1);
  }

  function goToStep(target: number) {
    setFieldErrors({});
    setError(null);
    setStep(target);
  }

  function closeOverlay() {
    const next = new URLSearchParams(searchParams ?? '');
    next.delete('drawer');
    next.delete('modal');
    const qs = next.toString();
    router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
  }

  function onCreated(id: string) {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      const mode = next.has('modal') ? 'modal' : 'drawer';
      next.delete('drawer');
      next.delete('modal');
      next.set(mode, `product:${id}`);
      router.replace(`${pathname ?? '/'}?${next.toString()}`);
      router.refresh();
      return;
    }
    router.push(`/commerce/products/${id}`);
    router.refresh();
  }

  // ── Submit ──────────────────────────────────────────────────────────────

  function handleSubmit() {
    setError(null);

    // Parse all the numbers here so the action receives clean integers.
    const priceCents = Math.round(parseFloat(pricing.priceStr) * 100);
    const compareAtRaw = pricing.compareAtStr ? parseFloat(pricing.compareAtStr) : undefined;
    const compareAtPriceCents =
      compareAtRaw !== undefined && !Number.isNaN(compareAtRaw)
        ? Math.round(compareAtRaw * 100)
        : undefined;

    const weightGrams =
      isPhysical && inventory.weightKgStr
        ? Math.round(parseFloat(inventory.weightKgStr) * 1000)
        : undefined;

    const hasDim =
      isPhysical && inventory.lengthCmStr && inventory.widthCmStr && inventory.heightCmStr;
    const dimensions = hasDim
      ? {
          lengthMm: Math.round(parseFloat(inventory.lengthCmStr) * 10),
          widthMm: Math.round(parseFloat(inventory.widthCmStr) * 10),
          heightMm: Math.round(parseFloat(inventory.heightCmStr) * 10),
        }
      : undefined;

    const initialQuantity =
      isPhysical && inventory.trackInventory && inventory.quantityStr
        ? parseInt(inventory.quantityStr, 10)
        : undefined;

    const lowStockThreshold =
      isPhysical && inventory.trackInventory && inventory.lowStockStr
        ? parseInt(inventory.lowStockStr, 10)
        : undefined;

    const input = {
      title: basics.title.trim(),
      sku: basics.sku.trim(),
      fulfillmentType: basics.fulfillmentType,
      priceCents,
      compareAtPriceCents,
      taxClass: pricing.taxClass.trim() || undefined,
      trackInventory: isPhysical ? inventory.trackInventory : undefined,
      initialQuantity,
      lowStockThreshold,
      weightGrams,
      dimensions,
    };

    startTransition(async () => {
      const result = await createProductWithVariantAction(input);
      if (result.ok) {
        onCreated(result.data.id);
        return;
      }
      if (result.error.code === 'CONFLICT' && result.error.message.includes('SKU')) {
        setFieldErrors({ sku: `SKU "${basics.sku}" is already in use. Choose a different SKU.` });
        setStep(0); // jump back to Basics
        return;
      }
      if (result.error.details?.length) {
        const fe: Record<string, string> = {};
        for (const d of result.error.details) fe[d.field] = d.message;
        setFieldErrors(fe);
      }
      setError(result.error.message);
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <Stack gap={6}>
      {surface === 'overlay' && (
        <Stack gap={1}>
          <Heading level={2}>New product</Heading>
          <Text size="sm" variant="muted">
            {step === 0
              ? "Name your product and pick its type. You'll set pricing and inventory next."
              : step === totalSteps - 1
                ? 'Review and create. You can edit everything from the product page afterwards.'
                : 'Fill in the details for this step, then continue.'}
          </Text>
        </Stack>
      )}

      <Stepper steps={steps} current={step} />

      <div>
        {stepName === 'basics' && (
          <StepBasics data={basics} onChange={setBasics} fieldErrors={fieldErrors} />
        )}
        {stepName === 'pricing' && (
          <StepPricing data={pricing} onChange={setPricing} fieldErrors={fieldErrors} />
        )}
        {stepName === 'inventory' && (
          <StepInventory data={inventory} onChange={setInventory} fieldErrors={fieldErrors} />
        )}
        {stepName === 'review' && (
          <StepReview
            basics={basics}
            pricing={pricing}
            inventory={isPhysical ? inventory : null}
            pending={pending}
            error={error}
            onEdit={goToStep}
            onSubmit={handleSubmit}
          />
        )}
      </div>

      {stepName !== 'review' && (
        <Stack direction="row" gap={3} align="center">
          {step > 0 ? (
            <Button variant="ghost" onClick={goBack} disabled={pending}>
              Back
            </Button>
          ) : surface === 'overlay' ? (
            <Button variant="ghost" onClick={closeOverlay} disabled={pending}>
              Cancel
            </Button>
          ) : null}

          <Button color="module" onClick={goNext} disabled={pending}>
            {step === totalSteps - 2 ? 'Review' : 'Continue'}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
