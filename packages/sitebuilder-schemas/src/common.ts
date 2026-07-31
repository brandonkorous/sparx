// Shared leaf schemas reused across section configs and site settings.

import { z } from 'zod';
import type { SectionField } from './fields';

export const Uuid = z.string().uuid();
export const OptionalUuid = z.string().uuid().optional().nullable();

// A media reference: either a media-library asset id (UUID) OR an absolute
// http(s) image/video URL. The URL form lets a tenant drop in an asset they
// already host (a CDN, a stock URL) without uploading into the library — the
// storefront resolver passes absolute URLs straight through (apps/site
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
// banner, panels, media+text, stats). `style` maps to a silica `btn-*` recipe —
// never a hand-built button (RULE #1). Sections expose up to two.
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

/**
 * A `media` field that accepts a library asset or a pasted image/video URL.
 * Pass `framing` to attach the visual framing modal (Fill/Fit + focal point +
 * zoom), naming the sibling config keys it reads/writes.
 */
export function mediaField(
  key: string,
  label: string,
  help?: string,
  framing?: { fitKey: string; focalKey: string; zoomKey?: string }
): SectionField {
  return {
    key,
    label,
    type: 'media',
    help: help ?? 'Pick an asset or paste an image URL.',
    fitKey: framing?.fitKey,
    focalKey: framing?.focalKey,
    zoomKey: framing?.zoomKey,
  };
}

// ── Image display: fit + focal point + zoom ─────────────────────────────────
// A pasted/uploaded image rarely matches its container's aspect ratio, so every
// image-bearing section can expose how it fills the box (`fit`), which part
// stays in frame (`focal`, an x/y % point), and how far to punch in (`zoom`).
// Edited via the visual framing modal; rendered as object-fit / object-position
// / transform. `cover` crops to fill (common); `contain` shows the whole image.

export const ObjectFit = z.enum(['cover', 'contain']);
export type ObjectFit = z.infer<typeof ObjectFit>;

// Focal point as percentages of the image box (0–100), defaulting to centre.
export const FocalPoint = z.object({
  x: z.number().min(0).max(100).default(50),
  y: z.number().min(0).max(100).default(50),
});
export type FocalPoint = z.infer<typeof FocalPoint>;

// Zoom / scale factor (1 = no zoom, 3 = 3×).
export const ImageZoom = z.number().min(1).max(3).default(1);

const clampPct = (n: number | null | undefined): number =>
  Math.max(0, Math.min(100, typeof n === 'number' && Number.isFinite(n) ? n : 50));

/** Map a focal point to a CSS background-position / object-position string. */
export function focalToPosition(focal?: { x?: number; y?: number } | null): string {
  return `${clampPct(focal?.x)}% ${clampPct(focal?.y)}%`;
}

// ── Section height ──────────────────────────────────────────────────────────
// A universal per-section vertical size, settable by the tenant on ANY page
// section. `auto` fits the content; the rest are fractions of the viewport
// (¼/½/¾/full). Applied by the storefront section wrapper as a `min-height`
// (so a tall section vertically centres its content). Hero/banner/carousel keep
// their own `height` field — this covers every other section type.

export const SectionHeight = z.enum(['auto', 'sm', 'md', 'lg', 'screen']);
export type SectionHeight = z.infer<typeof SectionHeight>;

/** The segmented "Section height" control shared by every static section. */
export function sectionHeightField(): SectionField {
  return {
    key: 'sectionHeight',
    label: 'Section height',
    type: 'buttongroup',
    help: 'How tall this section is — a fraction of the screen, or Auto to fit its content.',
    options: [
      { label: 'Auto', value: 'auto' },
      { label: '¼', value: 'sm' },
      { label: '½', value: 'md' },
      { label: '¾', value: 'lg' },
      { label: 'Full', value: 'screen' },
    ],
  };
}

/** The same options as a button group, without `auto`, for sections that are
 *  always sized (hero / banner / carousel). */
export const HEIGHT_BUTTON_OPTIONS: SectionField['options'] = [
  { label: '¼', value: 'sm' },
  { label: '½', value: 'md' },
  { label: '¾', value: 'lg' },
  { label: 'Full', value: 'screen' },
];
