import { z } from 'zod';
import { Align, OptionalMediaRef, ctas, ctasField, mediaField } from '../common';
import type { SectionField } from '../fields';

// A single panel within a Panels row. Each is a self-contained media card with
// an eyebrow, heading, subcopy, and up to two CTAs — the universal "feature card"
// (product pair, offer pair, category pair). Self-contained (a list item), NOT a
// nested section (docs/37 §4.2).
export const PanelItem = z.object({
  mediaId: OptionalMediaRef,
  eyebrow: z.string().max(80).default(''),
  heading: z.string().max(120).default(''),
  subheading: z.string().max(240).default(''),
  ctas: ctas([]),
});
export type PanelItem = z.infer<typeof PanelItem>;

export const PanelsConfig = z.object({
  heading: z.string().max(120).default(''),
  // media = full-bleed photo card with overlaid content; card = light surface
  // card (image sits inside, content below).
  variant: z.enum(['media', 'card']).default('media'),
  columns: z.number().int().min(1).max(4).default(2),
  // Content anchor inside each media-variant panel.
  align: Align.default('left'),
  verticalAlign: z.enum(['top', 'center', 'bottom']).default('bottom'),
  height: z.enum(['sm', 'md', 'lg']).default('lg'),
  textColor: z.enum(['auto', 'light', 'dark']).default('auto'),
  overlayOpacity: z.number().int().min(0).max(100).default(25),
  items: z.array(PanelItem).max(4).default([]),
});
export type PanelsConfig = z.infer<typeof PanelsConfig>;

export const panelsFields: SectionField[] = [
  { key: 'heading', label: 'Section heading', type: 'text', help: 'Optional, above the row.' },
  {
    key: 'variant',
    label: 'Panel style',
    type: 'select',
    options: [
      { label: 'Media (full-bleed photo)', value: 'media' },
      { label: 'Card (light surface)', value: 'card' },
    ],
  },
  { key: 'columns', label: 'Columns', type: 'range', min: 1, max: 4, step: 1 },
  {
    key: 'align',
    label: 'Content alignment (media)',
    type: 'select',
    options: [
      { label: 'Left', value: 'left' },
      { label: 'Center', value: 'center' },
      { label: 'Right', value: 'right' },
    ],
  },
  {
    key: 'verticalAlign',
    label: 'Content placement (media)',
    type: 'select',
    options: [
      { label: 'Top', value: 'top' },
      { label: 'Center', value: 'center' },
      { label: 'Bottom', value: 'bottom' },
    ],
  },
  {
    key: 'height',
    label: 'Panel height (media)',
    type: 'select',
    options: [
      { label: 'Small', value: 'sm' },
      { label: 'Medium', value: 'md' },
      { label: 'Large', value: 'lg' },
    ],
  },
  {
    key: 'textColor',
    label: 'Text color (media)',
    type: 'select',
    options: [
      { label: 'Auto', value: 'auto' },
      { label: 'Light', value: 'light' },
      { label: 'Dark', value: 'dark' },
    ],
  },
  {
    key: 'overlayOpacity',
    label: 'Overlay opacity (media)',
    type: 'range',
    min: 0,
    max: 100,
    step: 5,
  },
  {
    key: 'items',
    label: 'Panels',
    type: 'list',
    itemLabel: 'Panel',
    itemFields: [
      mediaField('mediaId', 'Image'),
      { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'subheading', label: 'Subheading', type: 'textarea' },
      ctasField(),
    ],
  },
];
