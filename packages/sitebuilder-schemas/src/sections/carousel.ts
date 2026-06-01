import { z } from 'zod';
import { Align, OptionalMediaRef, ctas, ctasField, mediaField } from '../common';
import type { SectionField } from '../fields';

// A single slide in a Carousel — a full-bleed media slide with overlaid
// eyebrow/heading/subcopy and up to two CTAs (the same self-contained shape as a
// Panel item, docs/37 §4.2). A list item, not a nested section.
export const CarouselSlide = z.object({
  mediaId: OptionalMediaRef,
  eyebrow: z.string().max(80).default(''),
  heading: z.string().max(120).default(''),
  subheading: z.string().max(240).default(''),
  ctas: ctas([]),
});
export type CarouselSlide = z.infer<typeof CarouselSlide>;

// Carousel — a horizontally-scrolling slider of media slides with optional
// autoplay, arrows, and dots (docs/37 §6, gap "no carousel/slider container").
// Scroll-snap + a small client island drive it; degrades to a swipeable strip
// without JS.
export const CarouselConfig = z.object({
  heading: z.string().max(120).default(''),
  height: z.enum(['sm', 'md', 'lg', 'screen']).default('lg'),
  // Content anchor inside each slide.
  align: Align.default('left'),
  verticalAlign: z.enum(['top', 'center', 'bottom']).default('bottom'),
  textColor: z.enum(['auto', 'light', 'dark']).default('auto'),
  overlayOpacity: z.number().int().min(0).max(100).default(30),
  // Per-slide button layout (row = side by side, stacked = one above the other).
  ctaLayout: z.enum(['row', 'stacked']).default('row'),
  autoplay: z.boolean().default(false),
  // Seconds between auto-advances (autoplay only).
  intervalSec: z.number().int().min(2).max(15).default(6),
  showArrows: z.boolean().default(true),
  showDots: z.boolean().default(true),
  items: z.array(CarouselSlide).max(8).default([]),
});
export type CarouselConfig = z.infer<typeof CarouselConfig>;

export const carouselFields: SectionField[] = [
  { key: 'heading', label: 'Section heading', type: 'text', help: 'Optional, above the carousel.' },
  {
    key: 'height',
    label: 'Slide height',
    type: 'select',
    options: [
      { label: 'Small', value: 'sm' },
      { label: 'Medium', value: 'md' },
      { label: 'Large', value: 'lg' },
      { label: 'Full screen', value: 'screen' },
    ],
  },
  {
    key: 'align',
    label: 'Content alignment',
    type: 'select',
    options: [
      { label: 'Left', value: 'left' },
      { label: 'Center', value: 'center' },
      { label: 'Right', value: 'right' },
    ],
  },
  {
    key: 'verticalAlign',
    label: 'Content placement',
    type: 'select',
    options: [
      { label: 'Top', value: 'top' },
      { label: 'Center', value: 'center' },
      { label: 'Bottom', value: 'bottom' },
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
  {
    key: 'ctaLayout',
    label: 'Button layout',
    type: 'select',
    options: [
      { label: 'Side by side', value: 'row' },
      { label: 'Stacked', value: 'stacked' },
    ],
  },
  { key: 'autoplay', label: 'Auto-advance slides', type: 'boolean' },
  { key: 'intervalSec', label: 'Seconds per slide', type: 'number', min: 2, max: 15, step: 1 },
  { key: 'showArrows', label: 'Show arrows', type: 'boolean' },
  { key: 'showDots', label: 'Show dots', type: 'boolean' },
  {
    key: 'items',
    label: 'Slides',
    type: 'list',
    itemLabel: 'Slide',
    itemFields: [
      mediaField('mediaId', 'Image'),
      { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'subheading', label: 'Subheading', type: 'textarea' },
      ctasField(),
    ],
  },
];
