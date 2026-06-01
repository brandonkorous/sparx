// Shared leaf schemas reused across section configs and site settings.

import { z } from 'zod';
import type { SectionField } from './fields';

export const Uuid = z.string().uuid();
export const OptionalUuid = z.string().uuid().optional().nullable();

// A media reference: either a media-library asset id (UUID) OR an absolute
// http(s) image/video URL. The URL form lets a merchant drop in an asset they
// already host (a CDN, a stock URL) without uploading into the library — the
// storefront resolver passes absolute URLs straight through (apps/storefront
// lib/media.ts). UUIDs still resolve via the public media redirect.
const ABSOLUTE_URL = /^https?:\/\//i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MediaRef = z
  .string()
  .max(2048)
  .refine((v) => ABSOLUTE_URL.test(v) || UUID_RE.test(v), {
    message: 'Must be a media id or an http(s) URL',
  });
export const OptionalMediaRef = MediaRef.optional().nullable();

// Hex color (#rgb or #rrggbb). Stored in VARCHAR(7) columns / token maps.
export const HexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be a hex color like #1a2b3c');

export const Align = z.enum(['left', 'center', 'right']);
export type Align = z.infer<typeof Align>;

export const AppearancePolicy = z.enum(['light-only', 'dark-only', 'auto', 'toggle']);
export type AppearancePolicy = z.infer<typeof AppearancePolicy>;

export const ThemeKey = z.enum(['apex', 'industrial', 'drift', 'market', 'fleet', 'drop']);
export type ThemeKey = z.infer<typeof ThemeKey>;

export const LayoutSlot = z.enum(['header', 'footer', 'announcement']);
export type LayoutSlot = z.infer<typeof LayoutSlot>;

// Optional bounded URL/path (internal "/foo" or external "https://…").
export const LinkUrl = z.string().max(2048);

// A call-to-action button, reused by every banner-like section (hero, image
// banner, panels, media+text, stats). `style` maps to a storefront `sf-btn--*`
// variant — never a hand-built button (brand rule). Sections expose up to two.
export const CtaStyle = z.enum(['solid', 'light', 'dark', 'ghost', 'link']);
export type CtaStyle = z.infer<typeof CtaStyle>;

export const Cta = z.object({
  label: z.string().max(60).default(''),
  url: LinkUrl.default(''),
  style: CtaStyle.default('solid'),
});
export type Cta = z.infer<typeof Cta>;

/** A `ctas` array schema (max 2) with a caller-supplied default set. */
export function ctas(defaults: z.infer<typeof Cta>[] = []) {
  return z.array(Cta).max(2).default(defaults);
}

// The editor sub-fields for one CTA, used as the `itemFields` of a `list`
// field. The dashboard's FieldControl renders nested lists recursively, so a
// section just spreads `ctasField()` into its fields.
export const ctaItemFields: SectionField[] = [
  { key: 'label', label: 'Label', type: 'text', placeholder: 'Shop now' },
  { key: 'url', label: 'Link', type: 'url', placeholder: '/products' },
  {
    key: 'style',
    label: 'Style',
    type: 'select',
    options: [
      { label: 'Solid (primary)', value: 'solid' },
      { label: 'Light (white)', value: 'light' },
      { label: 'Dark', value: 'dark' },
      { label: 'Ghost (outline)', value: 'ghost' },
      { label: 'Text link', value: 'link' },
    ],
  },
];

/** A ready-made `list` field for a section's CTA array (≤2 buttons). */
export function ctasField(key = 'ctas', label = 'Buttons'): SectionField {
  return {
    key,
    label,
    type: 'list',
    itemLabel: 'Button',
    itemFields: ctaItemFields,
    help: 'Up to 2 buttons.',
  };
}

/** A `media` field that accepts a library asset or a pasted image/video URL. */
export function mediaField(key: string, label: string, help?: string): SectionField {
  return { key, label, type: 'media', help: help ?? 'Pick an asset or paste an image URL.' };
}
