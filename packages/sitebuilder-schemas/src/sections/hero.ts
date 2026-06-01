import { z } from 'zod';
import { Align, OptionalMediaRef, ctas, ctasField, mediaField } from '../common';
import type { SectionField } from '../fields';

export const HeroConfig = z.object({
  backgroundMediaId: OptionalMediaRef,
  mediaType: z.enum(['image', 'video']).default('image'),
  eyebrow: z.string().max(80).default(''),
  heading: z.string().max(160).default('Your headline goes here'),
  subheading: z
    .string()
    .max(400)
    .default('Add a sentence that tells visitors what you offer and why it matters.'),
  // Up to two CTAs. A fresh hero ships with one solid button; legacy single-CTA
  // configs (ctaLabel/ctaUrl) are mapped in the storefront component.
  ctas: ctas([{ label: 'Shop now', url: '/products', style: 'solid' }]),
  align: Align.default('center'),
  verticalAlign: z.enum(['top', 'center', 'bottom']).default('center'),
  height: z.enum(['sm', 'md', 'lg', 'screen']).default('md'),
  // auto = white on a media background, themed text otherwise. light/dark force it.
  textColor: z.enum(['auto', 'light', 'dark']).default('auto'),
  overlayOpacity: z.number().int().min(0).max(100).default(40),
});
export type HeroConfig = z.infer<typeof HeroConfig>;

export const heroFields: SectionField[] = [
  mediaField('backgroundMediaId', 'Background image'),
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
    type: 'select',
    options: [
      { label: 'Small', value: 'sm' },
      { label: 'Medium', value: 'md' },
      { label: 'Large', value: 'lg' },
      { label: 'Full screen', value: 'screen' },
    ],
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
];
