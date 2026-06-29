'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Checkbox,
  Combobox,
  type ComboboxOption,
  Heading,
  Input,
  Label,
  MultiCombobox,
  NativeSelect,
  Stack,
  Text,
  Textarea,
} from '@sparx/ui';

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
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
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
    setError(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSavedAt(null);

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
          const fe: Record<string, string> = {};
          for (const d of result.error.details) fe[d.field] = d.message;
          setFieldErrors(fe);
        }
        setError(result.error.message);
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
      <Stack gap={4}>
        <Card variant="default">
          <CardHeader>
            <Heading level={3} as="h2">
              Basics
            </Heading>
            <CardDescription>Title, handle, description.</CardDescription>
          </CardHeader>
          <CardContent>
            <Stack gap={4}>
              <Stack gap={2}>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                />
                <FieldError msg={fieldErrors.title} />
              </Stack>
              <Stack gap={2}>
                <Label htmlFor="handle">Handle</Label>
                <Input
                  id="handle"
                  value={form.handle}
                  onChange={(e) => set('handle', e.target.value)}
                />
                <FieldError msg={fieldErrors.handle} />
              </Stack>
              <Stack gap={2}>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={6}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                />
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {sites.length > 1 && (
          <Card variant="default">
            <CardHeader>
              <Heading level={3} as="h2">
                Sites
              </Heading>
              <CardDescription>Which of your sites show this product.</CardDescription>
            </CardHeader>
            <CardContent>
              <SiteScopeField sites={sites} value={propertyIds} onChange={setPropertyIds} />
            </CardContent>
          </Card>
        )}

        <Card variant="default">
          <CardHeader>
            <Heading level={3} as="h2">
              Organization
            </Heading>
            <CardDescription>Type, vendor, tags, tax class.</CardDescription>
          </CardHeader>
          <CardContent>
            <Stack gap={4}>
              <Stack direction="row" gap={4} wrap>
                <Stack gap={2} className="min-w-[12rem] flex-1">
                  <Label htmlFor="productType">Product type</Label>
                  <Combobox
                    id="productType"
                    value={form.productType}
                    onChange={(v) => set('productType', v)}
                    options={toOptions(facets.productTypes)}
                    placeholder="Choose or add a type"
                    searchPlaceholder="Search or add a type…"
                    customHint="Add this product type"
                    aria-label="Product type"
                  />
                </Stack>
                <Stack gap={2} className="min-w-[12rem] flex-1">
                  <Label htmlFor="vendor">Vendor</Label>
                  <Combobox
                    id="vendor"
                    value={form.vendor}
                    onChange={(v) => set('vendor', v)}
                    options={toOptions(facets.vendors)}
                    placeholder="Choose or add a vendor"
                    searchPlaceholder="Search or add a vendor…"
                    customHint="Add this vendor"
                    aria-label="Vendor"
                  />
                </Stack>
              </Stack>
              <Stack gap={2}>
                <Label htmlFor="tags">Tags</Label>
                <MultiCombobox
                  id="tags"
                  value={form.tags}
                  onChange={(v) => set('tags', v)}
                  options={toOptions(facets.tags)}
                  max={50}
                  placeholder="Add a tag"
                  searchPlaceholder="Search or add a tag…"
                  customHint="Add this tag"
                  aria-label="Tags"
                />
                <Text size="xs" variant="muted">
                  Pick from existing tags or type a new one. Up to 50.
                </Text>
                <FieldError msg={fieldErrors['tags.0'] ?? fieldErrors.tags} />
              </Stack>
              <Stack gap={2} className="max-w-xs">
                <Label htmlFor="taxClass">Tax class</Label>
                <Combobox
                  id="taxClass"
                  value={form.taxClass}
                  onChange={(v) => set('taxClass', v)}
                  options={toOptions(facets.taxClasses)}
                  placeholder="Standard (default)"
                  searchPlaceholder="Search or add a tax class…"
                  customHint="Add this tax class"
                  aria-label="Tax class"
                />
                <Text size="xs" variant="muted">
                  Matches a tax rate&apos;s product class. Blank uses the standard rate.
                </Text>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card variant="default">
          <CardHeader>
            <Heading level={3} as="h2">
              Shipping &amp; fulfillment
            </Heading>
          </CardHeader>
          <CardContent>
            <Stack gap={4}>
              <Stack direction="row" gap={4} wrap>
                <Stack gap={2} className="min-w-[12rem] flex-1">
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
                </Stack>
                <Stack gap={2} className="min-w-[12rem] flex-1">
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
                </Stack>
              </Stack>
              <Stack direction="row" align="center" gap={2}>
                <Checkbox
                  id="requiresShipping"
                  color="module"
                  checked={form.requiresShipping}
                  onCheckedChange={(v) => set('requiresShipping', v === true)}
                />
                <Label htmlFor="requiresShipping">Requires shipping</Label>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      {/* The primary action floors the active frame (drawer / modal / full page)
          via the footer teleport — it renders OUTSIDE the scrolling body, so it
          pins to the frame's bottom edge instead of scrolling away with the form
          (a `sticky` bar inside the scroll body can't reach the modal's floor).
          The button is portaled out of this <form>, so it re-associates by id.
          Identity/lifecycle stay in the header; this carries only Save + result. */}
      <DetailFooterSlot>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-6 py-3">
          {error && (
            <Text size="sm" variant="danger" role="alert" aria-live="polite" className="mr-auto">
              {error}
            </Text>
          )}
          {savedAt !== null && !dirty && (
            <Stack
              direction="row"
              align="center"
              gap={1}
              className="text-[var(--color-success-text)]"
            >
              <Check className="h-4 w-4" />
              <Text size="sm" variant="success">
                Saved
              </Text>
            </Stack>
          )}
          <Button
            type="submit"
            form="product-edit-form"
            color="module"
            disabled={pending || !dirty}
            loading={pending}
          >
            Save changes
          </Button>
        </div>
      </DetailFooterSlot>
    </form>
  );
}

function FieldError({ msg }: { msg: string | undefined }) {
  if (!msg) return null;
  return (
    <Text size="xs" variant="danger">
      {msg}
    </Text>
  );
}
