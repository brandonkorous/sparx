'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Trash2 } from 'lucide-react';

import { ModuleProvider, SurfaceFrame, SurfaceStep, type SurfaceStepDef } from '@sparx/ui';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardTitle,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Input,
  NativeSelect,
  Table,
} from '@wizeworks/silicaui-react';
import { useFieldValidation } from '@sparx/forms';

import { createBundleAction, updateBundleAction } from '../../configurator-actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';

export interface BundleProductOption {
  id: string;
  title: string;
  handle: string;
  status: string;
}

export interface VariantOption {
  id: string;
  sku: string;
  title: string | null;
  priceCents: number;
  productId: string;
  productTitle: string;
}

export interface ComponentDraft {
  variantId: string;
  defaultQuantity: number;
  isRequired: boolean;
  isSwappable: boolean;
  swappableProductId: string | null;
  position: number;
}

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const CREATE_STEPS: SurfaceStepDef[] = [{ key: 'configure', label: 'Configure' }];

export function BundleEditor({
  products,
  variants,
  bundleId,
  surface = 'page',
  initialBundleProductId,
  initialPricingMode = 'sum_of_components',
  initialFixedPriceCents = null,
  initialPercentOffSum = null,
  initialInventoryMode = 'decrement_components',
  initialComponents = [],
}: {
  products: BundleProductOption[];
  variants: VariantOption[];
  bundleId?: string;
  /** Create surface only: `'page'` → embedded SurfaceFrame at `/new`;
   *  `'overlay'` → inline SurfaceFrame inside the @detail drawer/modal. Ignored
   *  on the edit path, which always renders the inline `<form>`. */
  surface?: 'page' | 'overlay';
  initialBundleProductId?: string;
  initialPricingMode?: 'sum_of_components' | 'fixed' | 'percent_off_sum';
  initialFixedPriceCents?: number | null;
  initialPercentOffSum?: number | null;
  initialInventoryMode?: 'decrement_components' | 'decrement_bundle_sku';
  initialComponents?: ComponentDraft[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isEdit = Boolean(bundleId);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [bundleProductId, setBundleProductId] = React.useState(initialBundleProductId ?? '');
  const [pricingMode, setPricingMode] = React.useState<
    'sum_of_components' | 'fixed' | 'percent_off_sum'
  >(initialPricingMode);
  const [fixedPriceDollars, setFixedPriceDollars] = React.useState<string>(
    initialFixedPriceCents != null ? (initialFixedPriceCents / 100).toFixed(2) : ''
  );
  const [percentOff, setPercentOff] = React.useState<string>(
    initialPercentOffSum != null ? String(initialPercentOffSum) : ''
  );
  const [inventoryMode, setInventoryMode] = React.useState<
    'decrement_components' | 'decrement_bundle_sku'
  >(initialInventoryMode);
  const [components, setComponents] = React.useState<ComponentDraft[]>(initialComponents);
  const [variantPick, setVariantPick] = React.useState<string>('');

  // Field validation. Fixed price / percent-off only apply in their pricing mode;
  // the wrapper product is required when creating (edit keeps its existing wrapper).
  const fieldValues = { bundleProductId, fixedPriceDollars, percentOff };
  const fields = useFieldValidation(fieldValues, {
    bundleProductId: (val) =>
      !isEdit && String(val).trim() === '' ? 'Pick a wrapper product.' : null,
    fixedPriceDollars: (val) => {
      if (pricingMode !== 'fixed') return null;
      const n = Number(String(val).trim());
      return Number.isFinite(n) && n > 0 ? null : 'Fixed price must be greater than 0.';
    },
    percentOff: (val) => {
      if (pricingMode !== 'percent_off_sum') return null;
      const n = Number(String(val).trim());
      return Number.isFinite(n) && n > 0 && n < 100
        ? null
        : 'Percent off must be between 0 and 100.';
    },
  });

  const variantById = React.useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  const sumOfComponentsCents = components.reduce((acc, c) => {
    const v = variantById.get(c.variantId);
    return acc + (v ? v.priceCents * c.defaultQuantity : 0);
  }, 0);

  function addComponent() {
    if (!variantPick) return;
    if (components.some((c) => c.variantId === variantPick)) {
      setError('That variant is already a component');
      return;
    }
    setComponents((prev) => [
      ...prev,
      {
        variantId: variantPick,
        defaultQuantity: 1,
        isRequired: true,
        isSwappable: false,
        swappableProductId: null,
        position: prev.length,
      },
    ]);
    setVariantPick('');
    setError(null);
  }

  function updateComponent(index: number, patch: Partial<ComponentDraft>) {
    setComponents((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function removeComponent(index: number) {
    setComponents((prev) =>
      prev.filter((_, i) => i !== index).map((c, i) => ({ ...c, position: i }))
    );
  }

  // Unsaved-changes guard. Compares live state to the initial props so both the
  // create path (frame Cancel) and the edit path (the [id] detail page's guarded
  // back-link / presentation switch) confirm before discarding edits (docs/105).
  const dirty =
    bundleProductId !== (initialBundleProductId ?? '') ||
    pricingMode !== initialPricingMode ||
    fixedPriceDollars !==
      (initialFixedPriceCents != null ? (initialFixedPriceCents / 100).toFixed(2) : '') ||
    percentOff !== (initialPercentOffSum != null ? String(initialPercentOffSum) : '') ||
    inventoryMode !== initialInventoryMode ||
    JSON.stringify(components) !== JSON.stringify(initialComponents);

  const guardLeave = useUnsavedGuard(dirty, { kind: isEdit ? 'edit' : 'create', noun: 'bundle' });

  // Where "leave the create form" goes, WITHOUT the guard. In the overlay it
  // clears the detail token so the drawer/modal closes in place; the page route
  // returns to the list. The success path (`onCreated`) navigates on its own.
  const close = React.useCallback(() => {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/commerce/bundles');
    }
  }, [surface, pathname, searchParams, router]);

  // Guarded leave for the create frame's Cancel.
  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  // After create: bundles flow into their detail view. On a page, navigate to it;
  // in an overlay, swap the detail token to the new record (preserving drawer vs
  // modal) so the panel transitions in place.
  function onCreated(id: string) {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      const mode = next.has('modal') ? 'modal' : 'drawer';
      next.delete('drawer');
      next.delete('modal');
      next.set(mode, `bundle:${id}`);
      router.replace(`${pathname ?? '/'}?${next.toString()}`);
      router.refresh();
      return;
    }
    router.push(`/commerce/bundles/${id}`);
  }

  function submit() {
    setError(null);

    if (components.length === 0) {
      setError('Add at least one component');
      return;
    }
    if (!fields.validate()) return;

    let fixedPriceCents: number | undefined;
    if (pricingMode === 'fixed') {
      fixedPriceCents = Math.round(Number(fixedPriceDollars) * 100);
    }
    let percentOffSum: number | undefined;
    if (pricingMode === 'percent_off_sum') {
      percentOffSum = Number(percentOff);
    }

    const payload = {
      pricingMode,
      fixedPriceCents,
      percentOffSum,
      inventoryMode,
      components: components.map((c, i) => ({
        variantId: c.variantId,
        defaultQuantity: c.defaultQuantity,
        isRequired: c.isRequired,
        isSwappable: c.isSwappable,
        swappableProductId: c.swappableProductId ?? undefined,
        position: i,
      })),
    };

    startTransition(async () => {
      if (isEdit && bundleId) {
        const result = await updateBundleAction(bundleId, payload);
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        router.refresh();
      } else {
        const result = await createBundleAction({ ...payload, bundleProductId });
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        onCreated(result.data.id);
      }
    });
  }

  // The picker + components table is identical across both surfaces, so it's
  // composed once and dropped into the edit `<form>` and the create card alike.
  const componentsSection = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0">
          <Heading3>Components</Heading3>
          <p className="text-base-content/70 text-xs">
            Sum of components: {moneyFmt.format(sumOfComponentsCents / 100)}
          </p>
        </div>
        <div className="flex flex-row items-center gap-2">
          {isEdit ? (
            <select
              value={variantPick}
              onChange={(e) => setVariantPick(e.target.value)}
              className="border-base-300 bg-base-100 h-9 max-w-[20rem] rounded border px-3 text-sm"
            >
              <option value="">— pick variant —</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.productTitle} · {v.sku}
                  {v.title ? ` (${v.title})` : ''} — {moneyFmt.format(v.priceCents / 100)}
                </option>
              ))}
            </select>
          ) : (
            <NativeSelect
              value={variantPick}
              onChange={(e) => setVariantPick(e.target.value)}
              className="max-w-[20rem]"
            >
              <option value="">— pick variant —</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.productTitle} · {v.sku}
                  {v.title ? ` (${v.title})` : ''} — {moneyFmt.format(v.priceCents / 100)}
                </option>
              ))}
            </NativeSelect>
          )}
          <Button type="button" variant="outline" onClick={addComponent}>
            Add
          </Button>
        </div>
      </div>

      {components.length === 0 ? (
        <p className="text-base-content/70 text-sm">
          No components yet — pick a variant above to add one.
        </p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Variant</th>
              <th>Default qty</th>
              <th>Required</th>
              <th>Swappable</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {components.map((c, i) => {
              const v = variantById.get(c.variantId);
              return (
                <tr key={c.variantId}>
                  <td>
                    <div className="flex flex-col gap-0">
                      <p className="text-sm">{v?.productTitle ?? '—'}</p>
                      <p className="text-base-content/70 text-xs">
                        {v?.sku ?? c.variantId.slice(0, 8) + '…'}
                      </p>
                    </div>
                  </td>
                  <td>
                    <Input
                      type="number"
                      min="1"
                      value={c.defaultQuantity}
                      onChange={(e) =>
                        updateComponent(i, {
                          defaultQuantity: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="w-20"
                    />
                  </td>
                  <td>
                    <Checkbox
                      color="module"
                      checked={c.isRequired}
                      onChange={(e) => updateComponent(i, { isRequired: e.target.checked })}
                    />
                  </td>
                  <td>
                    <Checkbox
                      color="module"
                      checked={c.isSwappable}
                      onChange={(e) => updateComponent(i, { isSwappable: e.target.checked })}
                    />
                    {c.isSwappable && (
                      <Badge color="accent" variant="soft" size="sm" className="ml-2">
                        same product
                      </Badge>
                    )}
                  </td>
                  <td>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeComponent(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );

  // ── EDIT path — render EXACTLY as before: inline <form> with raw <select>s and
  // its own "Save bundle" submit. The [id] detail page mounts this inline.
  if (isEdit) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-row flex-wrap gap-4">
            <Field className="min-w-[12rem] flex-1">
              <FieldLabel>Pricing mode</FieldLabel>
              <FieldControl
                render={
                  <NativeSelect
                    value={pricingMode}
                    onChange={(e) =>
                      setPricingMode(
                        e.target.value as 'sum_of_components' | 'fixed' | 'percent_off_sum'
                      )
                    }
                  >
                    <option value="sum_of_components">Sum of components</option>
                    <option value="fixed">Fixed price</option>
                    <option value="percent_off_sum">Percent off sum</option>
                  </NativeSelect>
                }
              />
            </Field>
            {pricingMode === 'fixed' && (
              <Field {...fields.field('fixedPriceDollars')} className="min-w-[10rem] flex-1">
                <FieldLabel>Fixed price (USD)</FieldLabel>
                <FieldControl
                  name="fixedPriceDollars"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={fixedPriceDollars}
                  onChange={(e) => setFixedPriceDollars(e.target.value)}
                  {...fields.control('fixedPriceDollars')}
                />
              </Field>
            )}
            {pricingMode === 'percent_off_sum' && (
              <Field {...fields.field('percentOff')} className="min-w-[10rem] flex-1">
                <FieldLabel>Percent off sum</FieldLabel>
                <FieldControl
                  name="percentOff"
                  type="number"
                  step="1"
                  min="1"
                  max="99"
                  value={percentOff}
                  onChange={(e) => setPercentOff(e.target.value)}
                  {...fields.control('percentOff')}
                />
              </Field>
            )}
            <Field className="min-w-[12rem] flex-1">
              <FieldLabel>Inventory mode</FieldLabel>
              <FieldControl
                render={
                  <NativeSelect
                    value={inventoryMode}
                    onChange={(e) =>
                      setInventoryMode(
                        e.target.value as 'decrement_components' | 'decrement_bundle_sku'
                      )
                    }
                  >
                    <option value="decrement_components">Decrement components</option>
                    <option value="decrement_bundle_sku">Decrement bundle SKU</option>
                  </NativeSelect>
                }
              />
              <FieldDescription>
                Choose &ldquo;bundle SKU&rdquo; when the wrapper product itself carries assembled
                stock.
              </FieldDescription>
            </Field>
          </div>

          {componentsSection}

          {error && (
            <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
              {error}
            </FieldStatus>
          )}

          <div className="flex flex-row justify-end gap-2">
            <Button color="module" type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save bundle'}
            </Button>
          </div>
        </div>
      </form>
    );
  }

  // ── CREATE path — the standard F-shell (docs/86). One-step SurfaceFrame whose
  // floor toolbar owns Cancel + the "Create bundle" primary (calling submit()
  // directly — no native form submit). Fields group into module-tinted cards.
  return (
    <ModuleProvider module="commerce" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="New bundle"
        steps={CREATE_STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'Bundle configuration',
            supporting:
              'Pick the wrapper product, add components, then choose how price + inventory resolve.',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Create bundle',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <div className="flex flex-col gap-6">
            <Card>
              <CardBody className="py-6">
                <div className="flex flex-col gap-1">
                  <CardTitle>Wrapper & pricing</CardTitle>
                  <p className="opacity-70">
                    The wrapper is the product the customer sees on the storefront, and it
                    can&apos;t already wrap another bundle.
                  </p>
                </div>
                <div className="flex flex-col gap-4">
                  <Field {...fields.field('bundleProductId')}>
                    <FieldLabel required>Bundle wrapper product</FieldLabel>
                    <FieldControl
                      name="bundleProductId"
                      value={bundleProductId}
                      onChange={(e) => setBundleProductId(e.target.value)}
                      {...fields.control('bundleProductId')}
                      render={
                        <NativeSelect>
                          <option value="">— select a product —</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title} ({p.status})
                            </option>
                          ))}
                        </NativeSelect>
                      }
                    />
                  </Field>

                  <div className="flex flex-row flex-wrap gap-4">
                    <Field className="min-w-[12rem] flex-1">
                      <FieldLabel>Pricing mode</FieldLabel>
                      <FieldControl
                        render={
                          <NativeSelect
                            value={pricingMode}
                            onChange={(e) =>
                              setPricingMode(
                                e.target.value as 'sum_of_components' | 'fixed' | 'percent_off_sum'
                              )
                            }
                          >
                            <option value="sum_of_components">Sum of components</option>
                            <option value="fixed">Fixed price</option>
                            <option value="percent_off_sum">Percent off sum</option>
                          </NativeSelect>
                        }
                      />
                    </Field>
                    {pricingMode === 'fixed' && (
                      <Field
                        {...fields.field('fixedPriceDollars')}
                        className="min-w-[10rem] flex-1"
                      >
                        <FieldLabel>Fixed price (USD)</FieldLabel>
                        <FieldControl
                          name="fixedPriceDollars"
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={fixedPriceDollars}
                          onChange={(e) => setFixedPriceDollars(e.target.value)}
                          {...fields.control('fixedPriceDollars')}
                        />
                      </Field>
                    )}
                    {pricingMode === 'percent_off_sum' && (
                      <Field {...fields.field('percentOff')} className="min-w-[10rem] flex-1">
                        <FieldLabel>Percent off sum</FieldLabel>
                        <FieldControl
                          name="percentOff"
                          type="number"
                          step="1"
                          min="1"
                          max="99"
                          value={percentOff}
                          onChange={(e) => setPercentOff(e.target.value)}
                          {...fields.control('percentOff')}
                        />
                      </Field>
                    )}
                    <Field className="min-w-[12rem] flex-1">
                      <FieldLabel>Inventory mode</FieldLabel>
                      <FieldControl
                        render={
                          <NativeSelect
                            value={inventoryMode}
                            onChange={(e) =>
                              setInventoryMode(
                                e.target.value as 'decrement_components' | 'decrement_bundle_sku'
                              )
                            }
                          >
                            <option value="decrement_components">Decrement components</option>
                            <option value="decrement_bundle_sku">Decrement bundle SKU</option>
                          </NativeSelect>
                        }
                      />
                      <FieldDescription>
                        Choose &ldquo;bundle SKU&rdquo; when the wrapper product itself carries
                        assembled stock.
                      </FieldDescription>
                    </Field>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="py-6">{componentsSection}</CardBody>
            </Card>
          </div>

          {error && (
            <FieldStatus
              status="error"
              attached={false}
              role="alert"
              aria-live="polite"
              className="mt-4"
            >
              {error}
            </FieldStatus>
          )}
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}

function Heading3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-medium">{children}</h3>;
}
