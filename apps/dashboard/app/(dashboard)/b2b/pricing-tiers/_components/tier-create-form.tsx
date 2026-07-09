'use client';

import * as React from 'react';
import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ModuleProvider, SurfaceFrame, SurfaceStep, type SurfaceStepDef } from '@sparx/ui';
import {
  Card,
  CardBody,
  CardTitle,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Select,
  Textarea,
} from '@wizeworks/silicaui-react';
import { rule, rules, useFieldValidation } from '@sparx/forms';

import { createPricingTier } from '../_lib/actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';

// Pricing-tier create on the standard form surface (docs/86 F layout). Create-only
// — tiers are read-only reference data in the list, so this drives just
// page / overlay. Validation runs on the shared `useFieldValidation` engine (the
// platform-wide Field/FieldStatus system) — no more react-hook-form. The frame's
// primary button submits the form by id (Enter-to-save works), Cancel is
// frame-owned.

type Presentation = 'page' | 'overlay';

type DiscountType = 'percentage' | 'fixed';
type ProductScope = 'all' | 'collections' | 'products';

const DISCOUNT_TYPE_ITEMS: Record<string, string> = {
  percentage: '% off list price',
  fixed: '$ fixed amount off',
};
const PRODUCT_SCOPE_ITEMS: Record<string, string> = {
  all: 'All products',
  collections: 'Selected collections',
  products: 'Selected products',
};

const FORM_ID = 'b2b-tier-create-form';
const STEPS: SurfaceStepDef[] = [{ key: 'basics', label: 'Basics' }];

// A non-negative number rule (value held as string state from the input).
const nonNegativeNumber =
  (message: string) =>
  (value: unknown): string | null => {
    const s = typeof value === 'string' ? value.trim() : '';
    if (s === '') return message;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? null : message;
  };

// Local max-length rule. `@sparx/forms` ships `minLength` but not `maxLength`;
// flagged upstream — inline here until a shared builder lands.
const maxLength =
  (max: number, message: string) =>
  (value: unknown): string | null =>
    typeof value === 'string' && value.length > max ? message : null;

export function TierCreateForm({ presentation }: { presentation: Presentation }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [formError, setFormError] = React.useState<string | null>(null);

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [discountType, setDiscountType] = React.useState<DiscountType>('percentage');
  const [discountValue, setDiscountValue] = React.useState('0');
  const [productScope, setProductScope] = React.useState<ProductScope>('all');
  const [minOrderCents, setMinOrderCents] = React.useState('0');

  const values = { name, description, discountValue, minOrderCents };
  const v = useFieldValidation(values, {
    name: rules(
      rule.required('Name is required.'),
      maxLength(127, 'Keep the name under 128 characters.')
    ),
    description: maxLength(2000, 'Keep the description under 2000 characters.'),
    discountValue: nonNegativeNumber('Enter a discount amount of 0 or more.'),
    minOrderCents: nonNegativeNumber('Enter a minimum of 0 or more.'),
  });

  const dirty =
    name.trim() !== '' ||
    description.trim() !== '' ||
    discountType !== 'percentage' ||
    discountValue !== '0' ||
    productScope !== 'all' ||
    minOrderCents !== '0';
  const guardLeave = useUnsavedGuard(dirty, {
    kind: 'create',
    noun: 'pricing tier',
  });

  const close = useCallback(() => {
    if (presentation === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
      return;
    }
    router.push('/b2b/pricing-tiers');
  }, [presentation, pathname, searchParams, router]);

  const cancel = useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!v.validate()) return;

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      discountType,
      discountValue: Number(discountValue),
      productScope,
      minOrderCents: Math.round(Number(minOrderCents)),
    };

    startTransition(async () => {
      const { error } = await createPricingTier(payload);
      if (error) {
        if (/name/i.test(error)) {
          v.setServerErrors({ name: error });
        } else {
          setFormError(error);
        }
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <ModuleProvider module="b2b" className="h-full">
      <SurfaceFrame
        variant={presentation === 'overlay' ? 'inline' : 'embedded'}
        title="New pricing tier"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'New pricing tier',
            supporting:
              'A named discount applied to B2B accounts. Product-level overrides take precedence over tier discounts.',
          }}
          actions={{
            nextForm: FORM_ID,
            nextLabel: 'Create tier',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <Card>
            <CardBody>
              <CardTitle>Tier details</CardTitle>
              <form id={FORM_ID} onSubmit={onSubmit} noValidate className="space-y-4">
                <Field {...v.field('name')}>
                  <FieldLabel required>Name</FieldLabel>
                  <FieldControl
                    name="name"
                    placeholder="e.g. Wholesale Tier 1"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    {...v.control('name')}
                  />
                </Field>

                <Field {...v.field('description')}>
                  <FieldLabel>Description</FieldLabel>
                  <FieldControl
                    name="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    {...v.control('description')}
                    render={<Textarea rows={2} placeholder="Optional description for staff" />}
                  />
                </Field>

                <div className="flex flex-row gap-3">
                  <Field className="flex-1">
                    <FieldLabel>Discount type</FieldLabel>
                    <Select
                      value={discountType}
                      onValueChange={(val) => setDiscountType(val as DiscountType)}
                      items={DISCOUNT_TYPE_ITEMS}
                    />
                  </Field>

                  <Field {...v.field('discountValue')} className="flex-1">
                    <FieldLabel required>Value</FieldLabel>
                    <FieldControl
                      name="discountValue"
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      {...v.control('discountValue')}
                    />
                  </Field>
                </div>

                <Field className="w-full">
                  <FieldLabel>Product scope</FieldLabel>
                  <Select
                    value={productScope}
                    onValueChange={(val) => setProductScope(val as ProductScope)}
                    items={PRODUCT_SCOPE_ITEMS}
                  />
                </Field>

                <Field {...v.field('minOrderCents')}>
                  <FieldLabel required>Minimum order (cents)</FieldLabel>
                  <FieldControl
                    name="minOrderCents"
                    type="number"
                    min={0}
                    step={1}
                    placeholder="0 (no minimum)"
                    value={minOrderCents}
                    onChange={(e) => setMinOrderCents(e.target.value)}
                    {...v.control('minOrderCents')}
                  />
                </Field>

                {formError && (
                  <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                    {formError}
                  </FieldStatus>
                )}
              </form>
            </CardBody>
          </Card>
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
