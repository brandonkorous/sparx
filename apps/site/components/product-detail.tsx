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
import type { PublicPreorderOffer, PublicProduct, PublicProductVariant } from '@/lib/commerce';
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
    const [addError, setAddError] = useState<string | null>(null);
    const [activeImageId, setActiveImageId] = useState<string | null>(
        () =>
            product.images.find((img) => !img.variantId && img.optionValueIds.length === 0)?.id ??
            product.images[0]?.id ??
            null
    );

    // Option-less multi-variant products — more than one purchasable SKU but no
    // ProductOption rows (e.g. a dropship import whose sizes/colors live only in
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

    // What we can honestly say about stock that is not here (docs/146 Phase
    // 9.3/9.4). A preorder is an offer with a stated date; `expectedBackAt` is the
    // soonest anybody waiting has been promised this item back. Either is worth
    // far more to a shopper than a bare "Sold out", and neither is ever invented —
    // both are null when nobody has committed to anything, and the copy says so.
    const preorder = resolvedVariant?.preorder ?? null;
    const isPreorder = preorder != null && preorder.isTakingOrders && !(available && available > 0);
    const expectedBackAt = resolvedVariant?.expectedBackAt ?? null;

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
        setAddError(null);
        try {
            await addItem(resolvedVariant.id, qty);
        } catch (err) {
            // The button's disabled state already prevents adding a KNOWN-sold-out
            // variant; this catches the race where stock ran out between page load and
            // the click (the server 409s). Show it instead of the old silent no-op.
            setAddError(err instanceof Error ? err.message : 'Sorry, we couldn’t add that to your cart.');
        } finally {
            setAdding(false);
        }
    }

    return (
        <div className="grid grid-cols-1 items-start gap-[clamp(1.5rem,4vw,4rem)] py-[clamp(1.5rem,4vw,3rem)] min-[901px]:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            {/* Gallery */}
            <div className="flex flex-col gap-3">
                <div className="rounded-box bg-base-200 relative aspect-square overflow-hidden">
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
                        <div
                            className="bg-base-200 text-base-content/40 grid h-full place-items-center text-5xl"
                            aria-hidden="true"
                        >
                            ◳
                        </div>
                    )}
                </div>
                {galleryImages.length > 1 ? (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2.5">
                        {galleryImages.map((img) => (
                            <button
                                key={img.id}
                                type="button"
                                className="rounded-field bg-base-200 aria-[current=true]:border-primary relative aspect-square cursor-pointer overflow-hidden border-2 border-transparent p-0"
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
            <div className="flex flex-col gap-5 min-[901px]:sticky min-[901px]:top-[92px]">
                {product.vendor ? (
                    <span className="text-base-content text-xs tracking-wider uppercase">
                        {product.vendor}
                    </span>
                ) : null}
                <h1 className="text-base-content text-[clamp(1.6rem,3vw,2.25rem)] font-semibold tracking-tight">
                    {product.title}
                </h1>

                <div className="text-base-content text-[1.6rem] font-semibold tracking-tight">
                    {yourPriceCents != null ? (
                        <>
                            Your price: {formatMoney(yourPriceCents, currency, locale)}
                            <span className="text-base-content ml-1.5 text-base font-normal line-through">
                                {formatMoney(priceCents, currency, locale)}
                            </span>
                        </>
                    ) : (
                        <>
                            {resolvedVariant
                                ? formatMoney(priceCents, currency, locale)
                                : formatPriceRange(product.priceMinCents, product.priceMaxCents, currency, locale)}
                            {onSale ? (
                                <span className="text-base-content ml-1.5 text-base font-normal line-through">
                                    {formatMoney(compareAt, currency, locale)}
                                </span>
                            ) : null}
                        </>
                    )}
                </div>

                <StockLine
                    inStock={inStock}
                    lowStock={lowStock}
                    available={available}
                    preorder={preorder}
                    expectedBackAt={expectedBackAt}
                    locale={locale}
                />

                {/* Variant selector — option-less products with multiple SKUs. The
            per-option chips below render nothing (no options), so this is the
            buyer's only way to reach the other variants. */}
                {optionless ? (
                    <div className="flex flex-col gap-2.5">
                        <span className="text-base-content text-sm font-semibold">
                            Variant
                            {resolvedVariant ? (
                                <span className="text-base-content ml-1.5 font-normal">
                                    {resolvedVariant.title ?? resolvedVariant.sku}
                                </span>
                            ) : null}
                        </span>
                        <div className="flex flex-wrap gap-2">
                            {product.variants.map((v) => (
                                <button
                                    key={v.id}
                                    type="button"
                                    className="rounded-selector border-base-300 bg-base-100 text-base-content hover:border-base-content aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary min-h-8 cursor-pointer border px-[0.95rem] py-[0.55rem] text-sm transition-colors disabled:cursor-not-allowed disabled:line-through disabled:opacity-40"
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
                        <div key={opt.id} className="flex flex-col gap-2.5">
                            <span className="text-base-content text-sm font-semibold">
                                {opt.name}
                                {selected[opt.id] ? (
                                    <span className="text-base-content ml-1.5 font-normal">
                                        {opt.values.find((v) => v.id === selected[opt.id])?.value}
                                    </span>
                                ) : null}
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {opt.values.map((val) => {
                                    const isSelected = selected[opt.id] === val.id;
                                    const disabled = !valueAvailable[val.id];
                                    return isSwatch && val.swatchHex ? (
                                        <button
                                            key={val.id}
                                            type="button"
                                            className="border-base-300 aria-pressed:border-primary aria-pressed:ring-primary aria-pressed:ring-offset-base-100 relative h-[38px] w-[38px] cursor-pointer rounded-full border-2 p-0 disabled:cursor-not-allowed disabled:opacity-45 aria-pressed:ring-2 aria-pressed:ring-offset-2"
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
                                            className="rounded-selector border-base-300 bg-base-100 text-base-content hover:border-base-content aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary min-h-8 cursor-pointer border px-[0.95rem] py-[0.55rem] text-sm transition-colors disabled:cursor-not-allowed disabled:line-through disabled:opacity-40"
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
                <div className="flex flex-wrap items-center gap-3">
                    <div className="rounded-field border-base-300 inline-flex items-center overflow-hidden border">
                        <button
                            type="button"
                            aria-label="Decrease quantity"
                            className="bg-base-100 text-base-content hover:bg-base-200 h-11 w-10 cursor-pointer border-0 text-lg transition-colors"
                            onClick={() => setQty((q) => Math.max(1, q - 1))}
                        >
                            −
                        </button>
                        <input
                            type="number"
                            min={1}
                            value={qty}
                            aria-label="Quantity"
                            className="border-base-300 bg-base-100 text-base-content h-11 w-11 [appearance:textfield] border-x text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                        />
                        <button
                            type="button"
                            aria-label="Increase quantity"
                            className="bg-base-100 text-base-content hover:bg-base-200 h-11 w-10 cursor-pointer border-0 text-lg transition-colors"
                            onClick={() => setQty((q) => q + 1)}
                        >
                            +
                        </button>
                    </div>
                    <Button
                        type="button"
                        color="primary"
                        size="lg"
                        className="min-w-[200px] flex-1"
                        disabled={!resolvedVariant || !inStock || adding}
                        onClick={handleAdd}
                    >
                        {!allSelected
                            ? 'Select options'
                            : !inStock
                                ? 'Sold out'
                                : adding
                                    ? 'Adding…'
                                    : isPreorder
                                        ? 'Preorder'
                                        : 'Add to cart'}
                    </Button>
                    {(resolvedVariant ?? defaultVariant) ? (
                        <WishlistButton variantId={(resolvedVariant ?? defaultVariant)!.id} />
                    ) : null}
                </div>

                {addError ? (
                    <p className="text-danger m-0 text-[0.95rem] font-medium" role="alert">
                        {addError}
                    </p>
                ) : null}

                {resolvedVariant?.sku ? (
                    <span className="text-base-content text-sm">SKU: {resolvedVariant.sku}</span>
                ) : null}
            </div>
        </div>
    );
}

/** A calendar date in the shopper's own language. Date only — an expected
 *  arrival is never accurate to the hour, and printing one implies it is. */
function formatArrival(iso: string, locale: string): string {
    return new Date(iso).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

/**
 * What the buy box says about supply.
 *
 * Five states, and the order they are tested in is the order of how much the
 * shopper gets to know. The two new ones both exist to replace a dead end:
 * "Sold out" ends the visit, "Preorder — ships 14 March" and "Back in stock 14
 * March" do not.
 *
 * Neither invents a date. A preorder with no confirmed date says exactly that,
 * which still sells, and an out-of-stock item nobody has promised back reads the
 * way it always has.
 */
function StockLine({
    inStock,
    lowStock,
    available,
    preorder,
    expectedBackAt,
    locale,
}: {
    inStock: boolean;
    lowStock: boolean;
    available: number | null;
    preorder: PublicPreorderOffer | null;
    expectedBackAt: string | null;
    locale: string;
}) {
    const hasStock = available != null && available > 0;

    // A live preorder wins over the plain out-of-stock line even when the policy
    // would let the item sell: the merchant has said something specific about this
    // one, and it is more use than anything derived.
    if (preorder && preorder.isTakingOrders && !hasStock) {
        return (
            <span className="text-base-content inline-flex flex-wrap items-center gap-1.5 text-sm font-medium">
                <span className="bg-info h-2 w-2 rounded-full" />
                {preorder.availableAt
                    ? `Preorder — ships ${formatArrival(preorder.availableAt, locale)}`
                    : 'Preorder — shipping date to be confirmed'}
                {preorder.availabilityNote ? (
                    <span className="text-base-content font-normal">· {preorder.availabilityNote}</span>
                ) : null}
                {/* Only when capped. `remaining` is null for an uncapped run, and there
            is no honest number to print for "no limit". */}
                {preorder.remaining != null ? (
                    <span className="text-base-content font-normal">· {preorder.remaining} left</span>
                ) : null}
            </span>
        );
    }

    if (!inStock || !hasStock) {
        return (
            <span className="text-base-content inline-flex items-center gap-1.5 text-sm font-medium">
                <span
                    className={
                        expectedBackAt
                            ? 'bg-warning h-2 w-2 rounded-full'
                            : 'bg-base-content/40 h-2 w-2 rounded-full'
                    }
                />
                {expectedBackAt
                    ? `Back in stock ${formatArrival(expectedBackAt, locale)}`
                    : inStock
                        ? 'Available to order'
                        : 'Out of stock'}
            </span>
        );
    }

    if (lowStock && available != null) {
        return (
            <span className="text-base-content inline-flex items-center gap-1.5 text-sm font-medium">
                <span className="bg-warning h-2 w-2 rounded-full" />
                Only {available} left
            </span>
        );
    }
    return (
        <span className="text-base-content inline-flex items-center gap-1.5 text-sm font-medium">
            <span className="bg-success h-2 w-2 rounded-full" />
            In stock
        </span>
    );
}
