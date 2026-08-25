// "Where this photo shows", as one answer instead of two fields.
//
// The endpoint takes `variantId` AND `optionValueIds`, and the storefront
// resolves them in that priority order. Exposed literally that is two controls
// that can contradict each other, and no owner of a shop should have to know
// which one wins. They collapse without loss into three mutually exclusive
// answers to one question — every version, one version, or a set of choices —
// so that is what is on screen, and `toBinding()` turns the answer back into the
// pair the server wants.

import type { ProductImage, ProductOption, Variant } from './products-data';

/** 8 MB. Bigger than any real product photo and far under the server's 200 MB
 *  ceiling — rejecting a 40 MB camera original HERE means the operator finds out
 *  instantly instead of after a minute of upload. */
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export const ACCEPTED_PHOTOS = 'image/jpeg,image/png,image/webp,image/avif,image/gif';

export type ShowMode = 'always' | 'variant' | 'choices';

export interface Binding {
  mode: ShowMode;
  /** Set when `mode` is `variant`. */
  variantId: string | null;
  /** One entry per option axis, `''` meaning "any value of this one". Kept as a
   *  full map rather than a sparse list so the controls are stable — an axis
   *  never disappears from the form because nothing is pinned on it. */
  byOption: Record<string, string>;
  alt: string;
}

export function toBindingDraft(image: ProductImage, options: ProductOption[]): Binding {
  const byOption: Record<string, string> = {};
  for (const option of options) {
    const chosen = option.values.find((value) => image.optionValueIds.includes(value.id));
    byOption[option.id] = chosen?.id ?? '';
  }
  const mode: ShowMode = image.variantId
    ? 'variant'
    : image.optionValueIds.length > 0
      ? 'choices'
      : 'always';
  return { mode, variantId: image.variantId, byOption, alt: image.alt ?? '' };
}

/** What the endpoint actually wants. `variantId`/`optionValueIds` are
 *  authoritative — an omitted one CLEARS — so every mode names both explicitly.
 *  `alt` is patch-style, and an emptied field means "clear it", not "blank
 *  string". */
export function toBinding(draft: Binding): {
  variantId: string | null;
  optionValueIds: string[];
  alt: string | null;
} {
  const alt = draft.alt.trim() === '' ? null : draft.alt.trim();
  if (draft.mode === 'variant') {
    return { variantId: draft.variantId, optionValueIds: [], alt };
  }
  if (draft.mode === 'choices') {
    return {
      variantId: null,
      optionValueIds: Object.values(draft.byOption).filter((id) => id !== ''),
      alt,
    };
  }
  return { variantId: null, optionValueIds: [], alt };
}

export function sameBinding(a: Binding, b: Binding): boolean {
  const left = toBinding(a);
  const right = toBinding(b);
  return (
    left.variantId === right.variantId &&
    left.alt === right.alt &&
    left.optionValueIds.length === right.optionValueIds.length &&
    left.optionValueIds.every((id) => right.optionValueIds.includes(id))
  );
}

export function variantLabel(variant: Variant): string {
  return variant.title?.trim() ? variant.title : variant.sku;
}

/** What this photo is currently pinned to, in the owner's words. Used on the
 *  tile so the gallery answers "which of these is the red one" without anything
 *  being selected first. */
export function bindingSummary(
  image: ProductImage,
  variants: Variant[],
  options: ProductOption[]
): string | null {
  if (image.variantId) {
    const variant = variants.find((row) => row.id === image.variantId);
    return variant ? variantLabel(variant) : 'One version';
  }
  if (image.optionValueIds.length === 0) return null;
  const names = options.flatMap((option) =>
    option.values.filter((value) => image.optionValueIds.includes(value.id)).map((v) => v.value)
  );
  return names.length > 0 ? names.join(' · ') : null;
}
