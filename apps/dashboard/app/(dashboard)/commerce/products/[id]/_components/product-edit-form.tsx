'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';

import {
  Combobox,
  Button,
  Card,
  CardBody,
  Checkbox,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Label,
  NativeSelect,
  Textarea,
} from '@wizeworks/silicaui-react';
import { AdaptiveLabel, type ComboboxOption, MultiCombobox, toast } from '@sparx/ui';
import { rule, useFieldValidation } from '@sparx/forms';

import type { Property } from '@/lib/sites';
import { SiteScopeField } from '../../../../_components/site-scope-field';
import { DetailFooterSlot } from '../../../../_components/detail-header-slot';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';

import { updateProductAction } from '../../../product-actions';
import type { ProductFacets } from './product-facets';

interface ProductOverview {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  productType: string | null;
  vendor: string | null;
  tags: string[];
  fulfillmentType: string;
  hazmatClass: string;
  requiresShipping: boolean;
  taxClass: string | null;
}

interface FormState {
  title: string;
  handle: string;
  description: string;
  productType: string;
  vendor: string;
  tags: string[];
  fulfillmentType: string;
  hazmatClass: string;
  requiresShipping: boolean;
  taxClass: string;
}

const toOptions = (values: string[]): ComboboxOption[] => values.map((value) => ({ value }));

// Overview-tab edit form — the product's own basics, organization (smart
// lookups seeded by tenant facets), and shipping. Controlled state with a Save
// that stays disabled until something actually changes (no autosave). SEO lives
// on its own tab now, not here.

export function ProductEditForm({
  product,
  sites,
  initialPropertyIds,
  facets,
}: {
  product: ProductOverview;
  // Multi-site (docs/49 §3) — the tenant's sites + this product's current scope.
  // SiteScopeField hides itself for single-site tenants.
  sites: Property[];
  initialPropertyIds: string[];
  // Open-ended suggestions for the type/vendor/tags/tax-class lookups.
  facets: ProductFacets;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [propertyIds, setPropertyIds] = React.useState<string[]>(initialPropertyIds);

  const initial = React.useMemo<FormState>(
    () => ({
      title: product.title,
      handle: product.handle,
      description: product.description ?? '',
      productType: product.productType ?? '',
      vendor: product.vendor ?? '',
      tags: product.tags,
      fulfillmentType: product.fulfillmentType,
      hazmatClass: product.hazmatClass,
      requiresShipping: product.requiresShipping,
      taxClass: product.taxClass ?? '',
    }),
    [product]
  );

  const [form, setForm] = React.useState<FormState>(initial);
  const [baseline, setBaseline] = React.useState<FormState>(initial);
  const [scopeBaseline, setScopeBaseline] = React.useState<string[]>(initialPropertyIds);

  const v = useFieldValidation(
    { title: form.title, handle: form.handle, tags: form.tags },
    {
      title: rule.required('Title is required.'),
      handle: rule.required('Handle is required.'),
    }
  );

  const dirty = React.useMemo(() => {
    const fieldsDirty = (Object.keys(form) as (keyof FormState)[]).some((k) => {
      const a = form[k];
      const b = baseline[k];
      if (Array.isArray(a) && Array.isArray(b)) return a.join(' ') !== b.join(' ');
      return a !== b;
    });
    const scopeDirty = sites.length > 1 && propertyIds.join(' ') !== scopeBaseline.join(' ');
    return fieldsDirty || scopeDirty;
  }, [form, baseline, propertyIds, scopeBaseline, sites.length]);

  // Unsaved-changes guard. The overlay chrome's Close / Switch / backdrop-Esc and
  // the full-page presentation switch all route through the shared leave guard
  // before they navigate — without this registration those paths silently discard
  // a half-edited product. Mirrors the category edit form (docs/86 + docs/105).
  useUnsavedGuard(dirty, { kind: 'edit', noun: 'product' });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavedAt(null);

    if (!v.validate()) return;

    const input = {
      title: form.title.trim(),
      handle: form.handle.trim(),
      description: form.description.trim() || null,
      productType: form.productType.trim() || null,
      vendor: form.vendor.trim() || null,
      tags: form.tags,
      fulfillmentType: form.fulfillmentType,
      hazmatClass: form.hazmatClass,
      requiresShipping: form.requiresShipping,
      taxClass: form.taxClass.trim() || null,
      // Model B (docs/49 §3): full-replacement site scope. Only sent for
      // multi-site tenants so single-site saves never write/clear scope rows.
      ...(sites.length > 1 ? { propertyIds } : {}),
    };

    startTransition(async () => {
      const result = await updateProductAction(product.id, input);
      if (!result.ok) {
        if (result.error.code === 'VALIDATION_ERROR' && result.error.details?.length) {
          const known = new Set(['title', 'handle', 'tags']);
          const map: Record<string, string> = {};
          for (const d of result.error.details) {
            const root = d.field.split('.')[0]!;
            if (known.has(root) && !(root in map)) map[root] = d.message;
          }
          if (Object.keys(map).length > 0) v.setServerErrors(map);
        }
        toast.error(result.error.message);
        return;
      }
      setBaseline(form);
      setScopeBaseline(propertyIds);
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  return (
    <form id="product-edit-form" onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-4">
        <Card>
          <CardBody>
            <h2 className="text-xl font-semibold">Basics</h2>
            <p className="opacity-70">Title, handle, description.</p>
            <div className="flex flex-col gap-4">
              <Field {...v.field('title')}>
                <FieldLabel required>Title</FieldLabel>
                <FieldControl
                  id="title"
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  {...v.control('title')}
                />
              </Field>
              <Field {...v.field('handle')}>
                <FieldLabel required>Handle</FieldLabel>
                <FieldControl
                  id="handle"
                  value={form.handle}
                  onChange={(e) => set('handle', e.target.value)}
                  {...v.control('handle')}
                />
              </Field>
              <Field>
                <FieldLabel>Description</FieldLabel>
                <FieldControl
                  id="description"
                  render={<Textarea rows={6} />}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                />
              </Field>
            </div>
          </CardBody>
        </Card>

        {sites.length > 1 && (
          <Card>
            <CardBody>
              <h2 className="text-xl font-semibold">Sites</h2>
              <p className="opacity-70">Which of your sites show this product.</p>
              <SiteScopeField sites={sites} value={propertyIds} onChange={setPropertyIds} />
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody>
            <h2 className="text-xl font-semibold">Organization</h2>
            <p className="opacity-70">Type, vendor, tags, tax class.</p>
            <div className="flex flex-col gap-4">
              <div className="flex flex-row flex-wrap gap-4">
                <div className="flex min-w-[12rem] flex-1 flex-col gap-2">
                  <Label htmlFor="productType">Product type</Label>
                  <Combobox
                    id="productType"
                    items={facets.productTypes}
                    value={form.productType}
                    onValueChange={(val) => set('productType', val as string)}
                    placeholder="Choose or add a type"
                  />
                </div>
                <div className="flex min-w-[12rem] flex-1 flex-col gap-2">
                  <Label htmlFor="vendor">Vendor</Label>
                  <Combobox
                    id="vendor"
                    value={form.vendor}
                    onValueChange={(val) => set('vendor', val as string)}
                    items={facets.vendors}
                    placeholder="Choose or add a vendor"
                    aria-label="Vendor"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="tags">Tags</Label>
                <MultiCombobox
                  id="tags"
                  value={form.tags}
                  onChange={(val) => set('tags', val)}
                  options={toOptions(facets.tags)}
                  max={50}
                  placeholder="Add a tag"
                  searchPlaceholder="Search or add a tag…"
                  customHint="Add this tag"
                  aria-label="Tags"
                />
                <p className="text-base-content text-xs">
                  Pick from existing tags or type a new one. Up to 50.
                </p>
                {v.visibleError('tags') && (
                  <FieldStatus status="error" attached={false}>
                    {v.visibleError('tags')}
                  </FieldStatus>
                )}
              </div>
              <div className="flex max-w-xs flex-col gap-2">
                <Label htmlFor="taxClass">Tax class</Label>
                <Combobox
                  id="taxClass"
                  value={form.taxClass}
                  onValueChange={(val) => set('taxClass', val as string)}
                  items={facets.taxClasses}
                  placeholder="Standard (default)"
                  aria-label="Tax class"
                />
                <p className="text-base-content text-xs">
                  Matches a tax rate&apos;s product class. Blank uses the standard rate.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="text-xl font-semibold">Shipping &amp; fulfillment</h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-row flex-wrap gap-4">
                <div className="flex min-w-[12rem] flex-1 flex-col gap-2">
                  <Label htmlFor="fulfillmentType">Fulfillment</Label>
                  <NativeSelect
                    id="fulfillmentType"
                    value={form.fulfillmentType}
                    onChange={(e) => set('fulfillmentType', e.target.value)}
                  >
                    <option value="physical">Physical goods</option>
                    <option value="digital">Digital download</option>
                    <option value="service">Service / booking</option>
                    <option value="configurable">Configurable (built-to-order)</option>
                    <option value="bundle">Bundle / kit</option>
                    <option value="subscription">Subscription</option>
                  </NativeSelect>
                </div>
                <div className="flex min-w-[12rem] flex-1 flex-col gap-2">
                  <Label htmlFor="hazmatClass">Hazmat class</Label>
                  <NativeSelect
                    id="hazmatClass"
                    value={form.hazmatClass}
                    onChange={(e) => set('hazmatClass', e.target.value)}
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
              </div>
              <div className="flex flex-row items-center gap-2">
                <Checkbox
                  id="requiresShipping"
                  color="module"
                  checked={form.requiresShipping}
                  onChange={(e) => set('requiresShipping', e.target.checked)}
                />
                <Label htmlFor="requiresShipping">Requires shipping</Label>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* The primary action teleports up into the frame's top toolbar (next to
          lifecycle actions), not floored at the bottom — it renders OUTSIDE the
          scrolling body, portaled out of this <form>, so it re-associates by id.
          A failed save surfaces as a toast — there's no room for a persistent
          error line in the compact shared toolbar row. */}
      <DetailFooterSlot>
        <div className="flex items-center gap-2">
          {savedAt !== null && !dirty && (
            <span className="text-success flex items-center gap-1 text-xs">
              <Check className="h-3.5 w-3.5" />
              Saved
            </span>
          )}
          <Button
            type="submit"
            form="product-edit-form"
            size="sm"
            color="module"
            disabled={pending || !dirty}
            loading={pending}
          >
            <AdaptiveLabel label={{ full: 'Save changes', short: 'Save' }} />
          </Button>
        </div>
      </DetailFooterSlot>
    </form>
  );
}
