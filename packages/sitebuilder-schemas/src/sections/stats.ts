import { z } from 'zod';
import { OptionalMediaRef, ctas, ctasField, mediaField } from '../common';
import type { SectionField } from '../fields';

// A band of big figures + labels, with an optional lead image (e.g. a map), a
// heading/subcopy, and up to two CTAs. Reusable for "by the numbers" sections.
export const StatItem = z.object({
  value: z.string().max(40).default(''),
  label: z.string().max(80).default(''),
});
export type StatItem = z.infer<typeof StatItem>;

export const StatsConfig = z.object({
  // Optional full-width image rendered above the stats row (map, photo, etc.).
  mediaId: OptionalMediaRef,
  heading: z.string().max(160).default(''),
  subheading: z.string().max(400).default(''),
  ctas: ctas([]),
  items: z.array(StatItem).max(6).default([]),
  columns: z.number().int().min(1).max(4).default(3),
  // Count each figure up from zero when it scrolls into view (the numeric part
  // of the value is animated; any prefix/suffix like "$" or "+" is preserved).
  // Falls back to the static value without JS or under reduced-motion.
  animate: z.boolean().default(true),
});
export type StatsConfig = z.infer<typeof StatsConfig>;

export const statsFields: SectionField[] = [
  mediaField('mediaId', 'Lead image (optional)', 'A wide image above the stats — e.g. a map.'),
  { key: 'heading', label: 'Heading', type: 'text' },
  { key: 'subheading', label: 'Subheading', type: 'textarea' },
  ctasField(),
  { key: 'columns', label: 'Columns', type: 'range', min: 1, max: 4, step: 1 },
  {
    key: 'animate',
    label: 'Count up on scroll',
    type: 'boolean',
    help: 'Animate each figure from zero when it enters the viewport.',
  },
  {
    key: 'items',
    label: 'Stats',
    type: 'list',
    itemLabel: 'Stat',
    itemFields: [
      { key: 'value', label: 'Value', type: 'text', placeholder: '37,412' },
      { key: 'label', label: 'Label', type: 'text', placeholder: 'Superchargers' },
    ],
  },
];
