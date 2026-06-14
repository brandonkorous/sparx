'use client';

// Tier-2 interactive commerce components for the Builder render path (docs/40 §7
// — "the product lives in Tier 2"). These are the data-aware, BEHAVIORAL atoms:
// they share one product-form context (selected options → resolved variant → qty
// → add-to-cart), so a VariantPicker, Quantity, and AddToCart placed anywhere in
// a product-bound subtree stay in sync. `BuyBox` is the cohesive convenience that
// bundles its own provider + the standard atoms.
//
// The variant-resolution + availability logic mirrors the legacy `ProductDetail`
// (the PDP buy-box) so behavior is identical; the cart wiring reuses the same
// global `useCart()` provider mounted in the storefront layout.

import * as React from 'react';

import { formatMoney } from '@/lib/format';
import { useCart } from './cart-provider';

// ── The product shape the buy-box reads (a subset of PublicProduct, mapped by
//    `productToBuilderRecord` in lib/builder-data). Carries cents + currency so
//    the client formats per selected variant. ────────────────────────────────
export interface BuilderOptionValue {
  id: string;
  value: string;
  swatchHex: string | null;
}
export interface BuilderOption {
  id: string;
  name: string;
  displayType: string;
  values: BuilderOptionValue[];
}
export interface BuilderVariant {
  id: string;
  sku: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  isDefault: boolean;
  inStock: boolean;
  available: number | null;
  optionValueIds: string[];
}
export interface BuilderProduct {
  title: string;
  price: number | null;
  compareAtPrice: number | null;
  description: string;
  images: { url: string; alt: string }[];
  sku: string;
  currency: string;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  options: BuilderOption[];
  variants: BuilderVariant[];
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
}

const ProductFormContext = React.createContext<ProductFormState | null>(null);

/** Read the shared product-form context. Returns null when an atom is placed
 *  outside a ProductForm/BuyBox — the atom then renders nothing. */
export function useProductForm(): ProductFormState | null {
  return React.useContext(ProductFormContext);
}

function useProductFormState(product: BuilderProduct): ProductFormState {
  const { addItem } = useCart();
  // Memoize on the (stable) product prop so the derived useMemos below don't see
  // a fresh `[]` every render (react-hooks/exhaustive-deps).
  const variants = React.useMemo(() => product.variants ?? [], [product]);
  const options = React.useMemo(() => product.options ?? [], [product]);

  const defaultVariant = variants.find((v) => v.isDefault) ?? variants[0];
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
  const [qty, setQty] = React.useState(1);
  const [adding, setAdding] = React.useState(false);

  const allSelected = options.length === 0 || Object.keys(selected).length === options.length;

  const resolvedVariant = React.useMemo<BuilderVariant | null>(() => {
    if (variants.length === 1) return variants[0] ?? null;
    if (!allSelected) return null;
    return (
      variants.find(
        (v) =>
          variantMatches(v, selected) && v.optionValueIds.length === Object.keys(selected).length
      ) ?? null
    );
  }, [variants, selected, allSelected]);

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

  const priceCents = resolvedVariant?.priceCents ?? product.priceMinCents ?? 0;
  const compareAtCents = resolvedVariant?.compareAtPriceCents ?? null;
  const onSale = compareAtCents != null && compareAtCents > priceCents;
  const inStock = resolvedVariant ? resolvedVariant.inStock : variants.some((v) => v.inStock);

  const addToCart = React.useCallback(async () => {
    if (!resolvedVariant?.inStock) return;
    setAdding(true);
    try {
      await addItem(resolvedVariant.id, qty);
    } finally {
      setAdding(false);
    }
  }, [addItem, resolvedVariant, qty]);

  return {
    product,
    selected,
    selectValue,
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
  return formatMoney(cents, currency, 'en-US');
}

// ── Atoms (read the shared context) ──────────────────────────────────────────

/** Option/variant selector — swatches when an option has hex values, else chips.
 *  Unavailable combinations are disabled (mirrors the legacy PDP). */
export function BuilderVariantPicker() {
  const f = useProductForm();
  if (!f || f.product.options.length === 0) return null;
  return (
    <div className="bx-variant-picker">
      {f.product.options.map((opt) => {
        const isSwatch = opt.displayType === 'swatch' || opt.values.some((v) => v.swatchHex);
        return (
          <div key={opt.id} className="st-option">
            <span className="st-option__label">
              {opt.name}
              {f.selected[opt.id] ? (
                <span className="st-muted" style={{ fontWeight: 400, marginLeft: '0.4rem' }}>
                  {opt.values.find((v) => v.id === f.selected[opt.id])?.value}
                </span>
              ) : null}
            </span>
            <div className="st-option__values">
              {opt.values.map((val) => {
                const isSelected = f.selected[opt.id] === val.id;
                const disabled = !f.valueAvailable[val.id];
                return isSwatch && val.swatchHex ? (
                  <button
                    key={val.id}
                    type="button"
                    className="st-swatch"
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
                    className="st-chip"
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
    <div className="st-qty">
      <button
        type="button"
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
        onChange={(e) => f.setQty(Math.max(1, Number(e.target.value) || 1))}
      />
      <button type="button" aria-label="Increase quantity" onClick={() => f.setQty(f.qty + 1)}>
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
      className="st-btn st-btn--primary st-btn--lg"
      style={{ minWidth: '200px' }}
      disabled={!f.resolvedVariant || !f.inStock || f.adding}
      onClick={() => void f.addToCart()}
    >
      {text}
    </button>
  );
}

// ── Cohesive BuyBox (own provider + the standard atoms) ───────────────────────

function BuyBoxInner() {
  const f = useProductForm();
  if (!f) return null;
  return (
    <div className="bx-buybox st-pdp__info">
      <div className="st-pdp__price">
        {moneyOf(f.priceCents, f.product.currency)}
        {f.onSale && f.compareAtCents != null ? (
          <span className="st-card__compare" style={{ fontSize: '1rem' }}>
            {moneyOf(f.compareAtCents, f.product.currency)}
          </span>
        ) : null}
      </div>
      <BuilderVariantPicker />
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <BuilderQuantity />
        <BuilderAddToCart />
      </div>
      {f.resolvedVariant?.sku ? (
        <span className="st-muted" style={{ fontSize: '0.82rem' }}>
          SKU: {f.resolvedVariant.sku}
        </span>
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
