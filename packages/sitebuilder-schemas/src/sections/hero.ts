import { z } from 'zod';
import {
  Align,
  FocalPoint,
  HEIGHT_BUTTON_OPTIONS,
  ImageZoom,
  ObjectFit,
  OptionalMediaRef,
  ctas,
  ctasField,
  mediaField,
} from '../common';
import type { SectionField } from '../fields';

export const HeroConfig = z.object({
  backgroundMediaId: OptionalMediaRef,
  mediaType: z.enum(['image', 'video']).default('image'),
  // How the background image fills the hero, which part stays in frame, and how
  // far to punch in — all edited via the visual framing modal.
  imageFit: ObjectFit.default('cover'),
  imageFocal: FocalPoint.default({ x: 50, y: 50 }),
  imageZoom: ImageZoom,
  eyebrow: z.string().max(80).default(''),
  heading: z.string().max(160).default('Your headline goes here'),
  subheading: z
    .string()
    .max(400)
    .default('Add a sentence that tells visitors what you offer and why it matters.'),
  // Up to two CTAs. A fresh hero ships with one solid button; legacy single-CTA
  // configs (ctaLabel/ctaUrl) are mapped in the storefront component.
  ctas: ctas([{ label: 'Shop now', url: '/products', style: 'solid' }]),
  // Row = buttons side by side; stacked = one above the other (the full-bleed
  // "two stacked pills" look common on car/product landing heroes).
  ctaLayout: z.enum(['row', 'stacked']).default('row'),
  align: Align.default('center'),
  verticalAlign: z.enum(['top', 'center', 'bottom']).default('center'),
  height: z.enum(['sm', 'md', 'lg', 'screen']).default('md'),
  // auto = white on a media background, themed text otherwise. light/dark force it.
  textColor: z.enum(['auto', 'light', 'dark']).default('auto'),
  overlayOpacity: z.number().int().min(0).max(100).default(40),
  // A pure-CSS bouncing scroll-down chevron at the bottom of the hero (the
  // full-screen "keep scrolling" affordance). Suits a `screen`-height hero.
  showScrollHint: z.boolean().default(false),
  // Break the text inner out of the sf-container max-width so content spans
  // edge-to-edge — the full-bleed "title at the viewport edge" treatment.
  fullBleed: z.boolean().default(false),
});
export type HeroConfig = z.infer<typeof HeroConfig>;

export const heroFields: SectionField[] = [
  mediaField('backgroundMediaId', 'Background image', undefined, {
    fitKey: 'imageFit',
    focalKey: 'imageFocal',
    zoomKey: 'imageZoom',
  }),
  {
    key: 'mediaType',
    label: 'Background type',
    type: 'select',
    options: [
      { label: 'Image', value: 'image' },
      { label: 'Video (mp4/webm URL)', value: 'video' },
    ],
  },
  { key: 'eyebrow', label: 'Eyebrow', type: 'text', help: 'Small label above the heading.' },
  { key: 'heading', label: 'Heading', type: 'text' },
  { key: 'subheading', label: 'Subheading', type: 'textarea' },
  ctasField(),
  {
    key: 'ctaLayout',
    label: 'Button layout',
    type: 'select',
    options: [
      { label: 'Side by side', value: 'row' },
      { label: 'Stacked', value: 'stacked' },
    ],
  },
  {
    key: 'align',
    label: 'Horizontal alignment',
    type: 'select',
    options: [
      { label: 'Left', value: 'left' },
      { label: 'Center', value: 'center' },
      { label: 'Right', value: 'right' },
    ],
  },
  {
    key: 'verticalAlign',
    label: 'Vertical placement',
    type: 'select',
    options: [
      { label: 'Top', value: 'top' },
      { label: 'Center', value: 'center' },
      { label: 'Bottom', value: 'bottom' },
    ],
  },
  {
    key: 'height',
    label: 'Height',
    type: 'buttongroup',
    options: HEIGHT_BUTTON_OPTIONS,
  },
  {
    key: 'textColor',
    label: 'Text color',
    type: 'select',
    options: [
      { label: 'Auto', value: 'auto' },
      { label: 'Light', value: 'light' },
      { label: 'Dark', value: 'dark' },
    ],
  },
  { key: 'overlayOpacity', label: 'Overlay opacity', type: 'range', min: 0, max: 100, step: 5 },
  {
    key: 'showScrollHint',
    label: 'Scroll-down hint',
    type: 'boolean',
    help: 'A bouncing chevron at the bottom — best with a full-screen hero.',
  },
  { key: 'fullBleed', label: 'Full-bleed text (edge to edge)', type: 'boolean' },
];
