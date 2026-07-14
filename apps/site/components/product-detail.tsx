'use client';

// Interactive PDP core. Holds the option selection, resolves the matching
// variant, and keeps the gallery, price, stock, and add-to-cart button in
// sync. Server-loaded product data comes in via props; all interactivity is
// client-side with no further fetches until "add to cart".

import Image from 'next/image';
import { useMemo, useState } from 'react';

import { Button } from '@wizeworks/silicaui-react';

import { formatMoney, formatPriceRange } from '@/lib/format';
import { mediaUrl } from '@/lib/media';
import type { PublicProduct, PublicProductVariant } from '@/lib/commerce';
import { useCart } from './cart-provider';
import { WishlistButton } from './wishlist-button';

export interface ProductDetailProps {
  product: PublicProduct;
  tenantSlug: string;
  currency: string;
  locale: string;
  showStockBelow: number;
}

// True when a variant's option assignment matches every currently-selected
// option value. Partial selections match any variant consistent so far.
function variantMatches(variant: PublicProductVariant, selected: Record<string, string>): boolean {
  const chosen = Object.values(selected);
  return chosen.every((valueId) => variant.optionValueIds.includes(valueId));
}

export function ProductDetail({
  product,
  tenantSlug,
  currency,
  locale,
  showStockBelow,
}: ProductDetailProps) {
  const { addItem } = useCart();

  // Default selection: the default variant's option values (so a single-variant
  // product is immediately purchasable).
  const defaultVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0];
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (defaultVariant) {
      for (const opt of product.options) {
        const match = opt.values.find((val) => defaultVariant.optionValueIds.includes(val.id));
        if (match) init[opt.id] = match.id;
      }
    }
    return init;
  });
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [activeImageId, setActiveImageId] = useState<string | null>(
    () =>
      product.images.find((img) => !img.variantId && img.optionValueIds.length === 0)?.id ??
      product.images[0]?.id ??
      null
  );

  // Option-less multi-variant products — more than one purchasable SKU but no
  // ProductOption rows (e.g. a dropship import whose sizes/colours live only in
  // the variant title) — are still selectable: fall back to picking the variant
  // directly by its title instead of stranding the buyer on the default. The
  // per-option chips below render nothing in this case, so without this the page
  // shows a single price and no way to reach the other SKUs. Single-variant and
  // option-driven products are unchanged.
  const optionless = product.options.length === 0 && product.variants.length > 1;
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(() =>
    optionless ? (defaultVariant?.id ?? null) : null
  );

  const allSelected = optionless
    ? selectedVariantId !== null
    : product.options.length === 0 || Object.keys(selected).length === product.options.length;

  const resolvedVariant = useMemo<PublicProductVariant | null>(() => {
    if (optionless) return product.variants.find((v) => v.id === selectedVariantId) ?? null;
    if (product.variants.length === 1) return product.variants[0] ?? null;
    if (!allSelected) return null;
    return (
      product.variants.find(
        (v) =>
          variantMatches(v, selected) && v.optionValueIds.length === Object.keys(selected).length
      ) ?? null
    );
  }, [product.variants, selected, allSelected, optionless, selectedVariantId]);

  // Availability per option value: a value is selectable if some variant with
  // that value (consistent with other current selections) is in stock-or-orderable.
  const valueAvailable = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const opt of product.options) {
      for (const val of opt.values) {
        const trial = { ...selected, [opt.id]: val.id };
        map[val.id] = product.variants.some((v) => variantMatches(v, trial) && v.inStock);
      }
    }
    return map;
  }, [product.options, product.variants, selected]);

  // Product-level images — pinned to no variant and no option value, i.e. the
  // "shown for every variant" baseline. Once a product carries per-variant or
  // per-option photos, this is the right fallback: returning EVERY image would
  // pile all colorways together whenever the current selection has no shots.
  const productLevelImages = useMemo(
    () => product.images.filter((img) => !img.variantId && img.optionValueIds.length === 0),
    [product.images]
  );

  // Gallery: prefer images tied to the resolved variant, then to the selected
  // option values, then the product-level baseline.
  const galleryImages = useMemo(() => {
    if (resolvedVariant) {
      const byVariant = product.images.filter((img) => img.variantId === resolvedVariant.id);
      if (byVariant.length) return byVariant;
    }
    const selectedValueIds = Object.values(selected);
    const byOption = product.images.filter(
      (img) =>
        img.optionValueIds.length > 0 &&
        img.optionValueIds.some((id) => selectedValueIds.includes(id))
    );
    if (byOption.length) return byOption;
    return productLevelImages.length > 0 ? productLevelImages : product.images;
  }, [product.images, productLevelImages, resolvedVariant, selected]);

  const activeImage = galleryImages.find((i) => i.id === activeImageId) ?? galleryImages[0] ?? null;

  const priceCents = resolvedVariant?.priceCents ?? product.priceMinCents ?? 0;
  const compareAt = resolvedVariant?.compareAtPriceCents ?? null;
  const onSale = compareAt != null && compareAt > priceCents;
  // A signed-in B2B customer's contract price for the resolved variant —
  // resolved through the same priority chain checkout uses, so it's exactly
  // what they'll be charged, not a separate estimate. Null for everyone else.
  const yourPriceCents = resolvedVariant?.yourPriceCents ?? null;

  const inStock = resolvedVariant ? resolvedVariant.inStock : product.inStock;
  const available = resolvedVariant?.available ?? null;
  const lowStock = available != null && available > 0 && available <= showStockBelow;

  function selectValue(optionId: string, valueId: string) {
    setSelected((prev) => ({ ...prev, [optionId]: valueId }));
    // Switch gallery to a matching image if one exists.
    const linked = product.images.find((img) => img.optionValueIds.includes(valueId));
    if (linked) setActiveImageId(linked.id);
  }

  function selectVariant(variantId: string) {
    setSelectedVariantId(variantId);
    // Switch the gallery to this variant's own image when it has one.
    const linked = product.images.find((img) => img.variantId === variantId);
    if (linked) setActiveImageId(linked.id);
  }

  async function handleAdd() {
    if (!resolvedVariant?.inStock) return;
    setAdding(true);
    try {
      await addItem(resolvedVariant.id, qty);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="st-pdp">
      {/* Gallery */}
      <div className="st-gallery">
        <div className="st-gallery__main">
          {activeImage && mediaUrl(activeImage.mediaAssetId, tenantSlug) ? (
            <Image
              src={mediaUrl(activeImage.mediaAssetId, tenantSlug)!}
              alt={activeImage.alt ?? product.title}
              fill
              priority
              sizes="(max-width: 980px) 100vw, 50vw"
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <div className="st-card__media--empty" style={{ height: '100%' }} aria-hidden="true">
              <span style={{ fontSize: '3rem' }}>◳</span>
            </div>
          )}
        </div>
        {galleryImages.length > 1 ? (
          <div className="st-gallery__thumbs">
            {galleryImages.map((img) => (
              <button
                key={img.id}
                type="button"
                className="st-thumb"
                aria-current={img.id === activeImage?.id}
                aria-label={img.alt ?? 'Product image'}
                onClick={() => setActiveImageId(img.id)}
              >
                {mediaUrl(img.mediaAssetId, tenantSlug) ? (
                  <Image
                    src={mediaUrl(img.mediaAssetId, tenantSlug)!}
                    alt=""
                    fill
                    sizes="72px"
                    style={{ objectFit: 'cover' }}
                  />
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Info */}
      <div className="st-pdp__info">
        {product.vendor ? <span className="st-card__vendor">{product.vendor}</span> : null}
        <h1 className="st-h1" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.25rem)' }}>
          {product.title}
        </h1>

        <div className="st-pdp__price">
          {yourPriceCents != null ? (
            <>
              Your price: {formatMoney(yourPriceCents, currency, locale)}
              <span className="st-card__compare" style={{ fontSize: '1rem' }}>
                {formatMoney(priceCents, currency, locale)}
              </span>
            </>
          ) : (
            <>
              {resolvedVariant
                ? formatMoney(priceCents, currency, locale)
                : formatPriceRange(product.priceMinCents, product.priceMaxCents, currency, locale)}
              {onSale ? (
                <span className="st-card__compare" style={{ fontSize: '1rem' }}>
                  {formatMoney(compareAt, currency, locale)}
                </span>
              ) : null}
            </>
          )}
        </div>

        <StockLine inStock={inStock} lowStock={lowStock} available={available} />

        {/* Variant selector — option-less products with multiple SKUs. The
            per-option chips below render nothing (no options), so this is the
            buyer's only way to reach the other variants. */}
        {optionless ? (
          <div className="st-option">
            <span className="st-option__label">
              Variant
              {resolvedVariant ? (
                <span className="st-muted" style={{ fontWeight: 400, marginLeft: '0.4rem' }}>
                  {resolvedVariant.title ?? resolvedVariant.sku}
                </span>
              ) : null}
            </span>
            <div className="st-option__values">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className="st-chip"
                  aria-pressed={selectedVariantId === v.id}
                  disabled={!v.inStock}
                  onClick={() => selectVariant(v.id)}
                >
                  {v.title ?? v.sku}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Options */}
        {product.options.map((opt) => {
          const isSwatch = opt.displayType === 'swatch' || opt.values.some((v) => v.swatchHex);
          return (
            <div key={opt.id} className="st-option">
              <span className="st-option__label">
                {opt.name}
                {selected[opt.id] ? (
                  <span className="st-muted" style={{ fontWeight: 400, marginLeft: '0.4rem' }}>
                    {opt.values.find((v) => v.id === selected[opt.id])?.value}
                  </span>
                ) : null}
              </span>
              <div className="st-option__values">
                {opt.values.map((val) => {
                  const isSelected = selected[opt.id] === val.id;
                  const disabled = !valueAvailable[val.id];
                  return isSwatch && val.swatchHex ? (
                    <button
                      key={val.id}
                      type="button"
                      className="st-swatch"
                      style={{ background: val.swatchHex }}
                      aria-pressed={isSelected}
                      aria-label={val.value}
                      disabled={disabled}
                      onClick={() => selectValue(opt.id, val.id)}
                    />
                  ) : (
                    <button
                      key={val.id}
                      type="button"
                      className="st-chip"
                      aria-pressed={isSelected}
                      disabled={disabled}
                      onClick={() => selectValue(opt.id, val.id)}
                    >
                      {val.value}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Quantity + add to cart */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="st-qty">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
            >
              −
            </button>
            <input
              type="number"
              min={1}
              value={qty}
              aria-label="Quantity"
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            />
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQty((q) => q + 1)}
            >
              +
            </button>
          </div>
          <Button
            type="button"
            color="primary"
            size="lg"
            style={{ flex: 1, minWidth: '200px' }}
            disabled={!resolvedVariant || !inStock || adding}
            onClick={handleAdd}
          >
            {!allSelected
              ? 'Select options'
              : !inStock
                ? 'Sold out'
                : adding
                  ? 'Adding…'
                  : 'Add to cart'}
          </Button>
          {(resolvedVariant ?? defaultVariant) ? (
            <WishlistButton variantId={(resolvedVariant ?? defaultVariant)!.id} />
          ) : null}
        </div>

        {resolvedVariant?.sku ? (
          <span className="st-muted" style={{ fontSize: '0.82rem' }}>
            SKU: {resolvedVariant.sku}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function StockLine({
  inStock,
  lowStock,
  available,
}: {
  inStock: boolean;
  lowStock: boolean;
  available: number | null;
}) {
  if (!inStock) {
    return (
      <span className="st-stock st-stock--out">
        <span className="st-stock__dot" />
        Out of stock
      </span>
    );
  }
  if (lowStock && available != null) {
    return (
      <span className="st-stock st-stock--low">
        <span className="st-stock__dot" />
        Only {available} left
      </span>
    );
  }
  return (
    <span className="st-stock">
      <span className="st-stock__dot" />
      In stock
    </span>
  );
}
