'use client';

// Tier-2 interactive commerce components for the Builder render path (docs/40 §7
// — "the product lives in Tier 2"). These are the data-aware, BEHAVIORAL atoms:
// they share one product-form context (selected options → resolved variant → qty
// → add-to-cart), so a VariantPicker, Quantity, and AddToCart placed anywhere in
// a product-bound subtree stay in sync. `BuyBox` is the cohesive convenience that
// bundles its own provider + the standard atoms.
//
// The variant-resolution + availability logic mirrors the legacy `ProductDetail`
// (the PDP buy-box) so behavior is identical. The terminal add-to-cart effect is
// injected via the Builder runtime (runtime-context.tsx): live wires it to the
// storefront <CartProvider>; the editor canvas leaves it a no-op, so the SAME
// component renders + behaves in the canvas without mutating a cart.

import * as React from 'react';
import { buttonClasses, cx } from '@wizeworks/silicaui-react/server';

import type { BuilderProduct, BuilderVariant } from './commerce-types';
import { useBuilderRuntime } from './runtime-context';

// ── The picker's own layout vocabulary ───────────────────────────────────────
//
// silica has no "product option row", so these are layout utilities, not a
// restyled control: an option's VALUES are real silica buttons (`btn`), and
// `btn-active` is how silica spells a pressed one.

const OPTION_ROW = 'flex flex-col gap-2';
const OPTION_LABEL = 'text-sm font-medium';
const OPTION_VALUES = 'flex flex-wrap items-center gap-2';

/** An option value rendered as a selectable chip. */
function chipClass(selected: boolean): string {
  return buttonClasses({ variant: 'outline', size: 'sm', active: selected });
}

/** A colour swatch. The fill is PRODUCT DATA (the option value's own hex), so it
 *  cannot come from a theme token — the selected ring and the border do. */
function swatchClass(selected: boolean): string {
  return cx(
    'size-8 rounded-full border transition-shadow disabled:opacity-40',
    selected ? 'border-primary ring-primary ring-2 ring-offset-2' : 'border-base-300'
  );
}

export type {
  BuilderProduct,
  BuilderOption,
  BuilderOptionValue,
  BuilderVariant,
} from './commerce-types';

// Money is integer cents on the wire; format only at the render boundary, per the
// selected variant + the product's currency. (Mirrors apps/site lib/format.)
function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

/** Display label for a variant chip in the option-less picker — its title, or
 *  the SKU when the supplier gave no title. */
function variantLabel(v: BuilderVariant): string {
  return v.title ?? v.sku;
}

// A variant matches when every currently-selected option value is one of its
// assignments (partial selections match any still-consistent variant).
function variantMatches(variant: BuilderVariant, selected: Record<string, string>): boolean {
  return Object.values(selected).every((valueId) => variant.optionValueIds.includes(valueId));
}

interface ProductFormState {
  product: BuilderProduct;
  selected: Record<string, string>;
  selectValue: (optionId: string, valueId: string) => void;
  // Option-less products with >1 SKU: the buyer picks a variant directly (by
  // title) since there are no option chips to render.
  optionless: boolean;
  selectedVariantId: string | null;
  selectVariant: (variantId: string) => void;
  qty: number;
  setQty: (q: number) => void;
  adding: boolean;
  resolvedVariant: BuilderVariant | null;
  allSelected: boolean;
  valueAvailable: Record<string, boolean>;
  priceCents: number;
  compareAtCents: number | null;
  onSale: boolean;
  inStock: boolean;
  addToCart: () => Promise<void>;
  buyNow: () => Promise<void>;
  /** Set when the last add/buy failed (e.g. the variant sold out between load and
   *  click → the cart API 409s). Surfaced by the buy box instead of a silent no-op. */
  addError: string | null;
}

const ProductFormContext = React.createContext<ProductFormState | null>(null);

/** Read the shared product-form context. Returns null when an atom is placed
 *  outside a ProductForm/BuyBox — the atom then renders nothing. */
export function useProductForm(): ProductFormState | null {
  return React.useContext(ProductFormContext);
}

function useProductFormState(product: BuilderProduct): ProductFormState {
  // Terminal add-to-cart effect — the real storefront cart under a provider, a
  // no-op in the editor canvas (runtime-context.tsx).
  const runtime = useBuilderRuntime();
  // Memoize on the (stable) product prop so the derived useMemos below don't see
  // a fresh `[]` every render (react-hooks/exhaustive-deps).
  const variants = React.useMemo(() => product.variants ?? [], [product]);
  const options = React.useMemo(() => product.options ?? [], [product]);

  const defaultVariant = variants.find((v) => v.isDefault) ?? variants[0];
  // More than one purchasable SKU but no options to drive the picker — fall back
  // to direct variant selection so the buyer isn't stranded on the default.
  const optionless = options.length === 0 && variants.length > 1;
  const [selected, setSelected] = React.useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (defaultVariant) {
      for (const opt of options) {
        const match = opt.values.find((val) => defaultVariant.optionValueIds.includes(val.id));
        if (match) init[opt.id] = match.id;
      }
    }
    return init;
  });
  const [selectedVariantId, setSelectedVariantId] = React.useState<string | null>(() =>
    optionless ? (defaultVariant?.id ?? null) : null
  );
  const [qty, setQty] = React.useState(1);
  const [adding, setAdding] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);

  const allSelected = optionless
    ? selectedVariantId !== null
    : options.length === 0 || Object.keys(selected).length === options.length;

  const resolvedVariant = React.useMemo<BuilderVariant | null>(() => {
    if (optionless) return variants.find((v) => v.id === selectedVariantId) ?? null;
    if (variants.length === 1) return variants[0] ?? null;
    if (!allSelected) return null;
    return (
      variants.find(
        (v) =>
          variantMatches(v, selected) && v.optionValueIds.length === Object.keys(selected).length
      ) ?? null
    );
  }, [variants, selected, allSelected, optionless, selectedVariantId]);

  const valueAvailable = React.useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const opt of options) {
      for (const val of opt.values) {
        const trial = { ...selected, [opt.id]: val.id };
        map[val.id] = variants.some((v) => variantMatches(v, trial) && v.inStock);
      }
    }
    return map;
  }, [options, variants, selected]);

  const selectValue = React.useCallback((optionId: string, valueId: string) => {
    setSelected((prev) => ({ ...prev, [optionId]: valueId }));
  }, []);

  const selectVariant = React.useCallback((variantId: string) => {
    setSelectedVariantId(variantId);
  }, []);

  const priceCents = resolvedVariant?.priceCents ?? product.priceMinCents ?? 0;
  const compareAtCents = resolvedVariant?.compareAtPriceCents ?? null;
  const onSale = compareAtCents != null && compareAtCents > priceCents;
  const inStock = resolvedVariant ? resolvedVariant.inStock : variants.some((v) => v.inStock);

  const addToCart = React.useCallback(async () => {
    if (!resolvedVariant?.inStock) return;
    setAdding(true);
    setAddError(null);
    try {
      await runtime.addToCart(resolvedVariant.id, qty);
    } catch (err) {
      // The button already disables for a KNOWN sold-out variant; this catches the
      // race where it sold out between load and click (the cart API 409s). Show it
      // instead of a silent no-op / unhandled rejection (BUG-001).
      setAddError(err instanceof Error ? err.message : 'Sorry, we couldn’t add that to your cart.');
    } finally {
      setAdding(false);
    }
  }, [runtime, resolvedVariant, qty]);

  // "Buy now" — add the resolved variant, then the runtime sends the buyer to
  // checkout (live) / does nothing (canvas). Same guard as addToCart.
  const buyNow = React.useCallback(async () => {
    if (!resolvedVariant?.inStock) return;
    setAdding(true);
    setAddError(null);
    try {
      await runtime.buyNow(resolvedVariant.id, qty);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Sorry, we couldn’t add that to your cart.');
    } finally {
      setAdding(false);
    }
  }, [runtime, resolvedVariant, qty]);

  return {
    product,
    selected,
    selectValue,
    optionless,
    selectedVariantId,
    selectVariant,
    qty,
    setQty,
    adding,
    resolvedVariant,
    allSelected,
    valueAvailable,
    priceCents,
    compareAtCents,
    onSale,
    inStock,
    addToCart,
    buyNow,
    addError,
  };
}

/** Establishes the shared product-form context over a product-bound subtree.
 *  Rendered by the builder renderer at a `ProductForm` container node bound to
 *  `product`; the atoms below read it. No variants → renders children inert. */
export function ProductFormProvider({
  product,
  children,
}: {
  product: BuilderProduct;
  children: React.ReactNode;
}) {
  const state = useProductFormState(product);
  return <ProductFormContext.Provider value={state}>{children}</ProductFormContext.Provider>;
}

function moneyOf(cents: number, currency: string): string {
  return formatMoney(cents, currency);
}

// ── Atoms (read the shared context) ──────────────────────────────────────────

/** Option/variant selector — swatches when an option has hex values, else chips.
 *  Unavailable combinations are disabled (mirrors the legacy PDP). */
export function BuilderVariantPicker() {
  const f = useProductForm();
  if (!f) return null;
  // Option-less products with multiple SKUs: pick the variant directly by title.
  if (f.optionless) {
    return (
      <div className="bx-variant-picker">
        <div className={OPTION_ROW}>
          <span className={OPTION_LABEL}>
            Variant
            {f.resolvedVariant ? (
              <span className="text-base-content ml-1.5 font-normal">
                {variantLabel(f.resolvedVariant)}
              </span>
            ) : null}
          </span>
          <div className={OPTION_VALUES}>
            {f.product.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                className={chipClass(f.selectedVariantId === v.id)}
                aria-pressed={f.selectedVariantId === v.id}
                disabled={!v.inStock}
                onClick={() => f.selectVariant(v.id)}
              >
                {variantLabel(v)}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (f.product.options.length === 0) return null;
  return (
    <div className="bx-variant-picker">
      {f.product.options.map((opt) => {
        const isSwatch = opt.displayType === 'swatch' || opt.values.some((v) => v.swatchHex);
        return (
          <div key={opt.id} className={OPTION_ROW}>
            <span className={OPTION_LABEL}>
              {opt.name}
              {f.selected[opt.id] ? (
                <span className="text-base-content ml-1.5 font-normal">
                  {opt.values.find((v) => v.id === f.selected[opt.id])?.value}
                </span>
              ) : null}
            </span>
            <div className={OPTION_VALUES}>
              {opt.values.map((val) => {
                const isSelected = f.selected[opt.id] === val.id;
                const disabled = !f.valueAvailable[val.id];
                return isSwatch && val.swatchHex ? (
                  <button
                    key={val.id}
                    type="button"
                    className={swatchClass(isSelected)}
                    // The ONE inline style in the render path, unchanged from the
                    // pre-silica picker: this hex is the merchant's own option
                    // value from the database, not a design decision, so no token
                    // can express it. Everything else on the control is silica.
                    style={{ background: val.swatchHex }}
                    aria-pressed={isSelected}
                    aria-label={val.value}
                    disabled={disabled}
                    onClick={() => f.selectValue(opt.id, val.id)}
                  />
                ) : (
                  <button
                    key={val.id}
                    type="button"
                    className={chipClass(isSelected)}
                    aria-pressed={isSelected}
                    disabled={disabled}
                    onClick={() => f.selectValue(opt.id, val.id)}
                  >
                    {val.value}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Quantity stepper bound to the shared form. */
export function BuilderQuantity() {
  const f = useProductForm();
  if (!f) return null;
  return (
    <div className="join">
      <button
        type="button"
        className={buttonClasses({ variant: 'outline', className: 'join-item' })}
        aria-label="Decrease quantity"
        onClick={() => f.setQty(Math.max(1, f.qty - 1))}
      >
        −
      </button>
      <input
        type="number"
        min={1}
        value={f.qty}
        aria-label="Quantity"
        className="input join-item w-16 text-center"
        onChange={(e) => f.setQty(Math.max(1, Number(e.target.value) || 1))}
      />
      <button
        type="button"
        className={buttonClasses({ variant: 'outline', className: 'join-item' })}
        aria-label="Increase quantity"
        onClick={() => f.setQty(f.qty + 1)}
      >
        +
      </button>
    </div>
  );
}

/** Add-to-cart button — disabled until a variant resolves + is in stock; label
 *  reflects state (Select options / Sold out / Adding… / Add to cart). */
export function BuilderAddToCart({ label }: { label?: string }) {
  const f = useProductForm();
  if (!f) return null;
  const text = !f.allSelected
    ? 'Select options'
    : !f.inStock
      ? 'Sold out'
      : f.adding
        ? 'Adding…'
        : (label ?? 'Add to cart');
  return (
    <button
      type="button"
      className={buttonClasses({ color: 'primary', size: 'lg', className: 'min-w-[200px]' })}
      disabled={!f.resolvedVariant || !f.inStock || f.adding}
      onClick={() => void f.addToCart()}
    >
      {text}
    </button>
  );
}

/** Any element turned into a cart/navigation TRIGGER (docs/98 Pillar 7) — the
 *  generalization of `AddToCart` to any button/link via an action binding. An
 *  `add-to-cart`/`buy-now` action reads the shared product form an ancestor
 *  product scope establishes (a pinned product card, or one item of a repeated
 *  collection), so a button placed anywhere inside that scope sells the RIGHT
 *  variant. `link` is an `<a>`; `submit` a real submit button. The element wears
 *  the author's `className` (its Tailwind classes) verbatim. */
export function BuilderActionButton({
  action,
  label,
  className,
  href,
  children,
}: {
  action: 'add-to-cart' | 'buy-now' | 'link' | 'submit';
  label: string;
  className?: string;
  href?: string;
  children?: React.ReactNode;
}) {
  const f = useProductForm();

  if (action === 'link') {
    // A link inside a product scope (a card in a collection repeater, or a pinned
    // product) may template the scoped product into its href — `{{item.field}}` /
    // `{{product.field}}` — so a product card links to its own PDP
    // (`/products/{{item.handle}}`). Resolved from the scoped product; outside a scope
    // (no `f`) the raw href passes through. Product fields are slugs/ids (url-safe).
    const resolved =
      href && href.includes('{{') && f
        ? href.replace(/\{\{\s*(?:item|product)\.(\w+)\s*\}\}/g, (_m, field: string) => {
            const v = (f.product as unknown as Record<string, unknown>)[field];
            return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
          })
        : href;
    return (
      <a href={resolved ?? '#'} className={className}>
        {label}
        {children}
      </a>
    );
  }
  if (action === 'submit') {
    return (
      <button type="submit" className={className}>
        {label}
        {children}
      </button>
    );
  }

  // add-to-cart / buy-now — wired to the ancestor product form. With no product
  // scope the button still renders (so the author sees it) but is inert.
  const text = !f
    ? label
    : !f.allSelected
      ? 'Select options'
      : !f.inStock
        ? 'Sold out'
        : f.adding
          ? 'Adding…'
          : label;
  const disabled = !(f?.resolvedVariant && f.inStock && !f.adding);
  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={() => {
        if (!f) return;
        void (action === 'buy-now' ? f.buyNow() : f.addToCart());
      }}
    >
      {text}
      {children}
    </button>
  );
}

// ── Cohesive BuyBox (own provider + the standard atoms) ───────────────────────

function BuyBoxInner() {
  const f = useProductForm();
  if (!f) return null;
  return (
    <div className="bx-buybox flex flex-col gap-5">
      <div className="text-2xl font-semibold tabular-nums">
        {moneyOf(f.priceCents, f.product.currency)}
        {f.onSale && f.compareAtCents != null ? (
          <span className="ms-2 text-base font-normal line-through">
            {moneyOf(f.compareAtCents, f.product.currency)}
          </span>
        ) : null}
      </div>
      <BuilderVariantPicker />
      <div className="flex flex-wrap items-center gap-3">
        <BuilderQuantity />
        <BuilderAddToCart />
      </div>
      {f.addError ? (
        <p className="text-error" role="alert">
          {f.addError}
        </p>
      ) : null}
    </div>
  );
}

/** The cohesive buy-box: price + variant picker + quantity + add-to-cart in one
 *  self-contained block (establishes its own form context). Bound to `product`. */
export function BuilderBuyBox({ product }: { product: BuilderProduct }) {
  if (!product || !Array.isArray(product.variants) || product.variants.length === 0) return null;
  return (
    <ProductFormProvider product={product}>
      <BuyBoxInner />
    </ProductFormProvider>
  );
}
