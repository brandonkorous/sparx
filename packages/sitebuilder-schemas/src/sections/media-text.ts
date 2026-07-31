import { z } from 'zod';
import {
  FocalPoint,
  ObjectFit,
  OptionalMediaRef,
  SectionHeight,
  ctas,
  ctasField,
  mediaField,
  sectionHeightField,
} from '../common';
import type { SectionField } from '../fields';

// A side-by-side band: a media column beside a text column (eyebrow / heading /
// body / CTAs). The classic alternating feature/explainer row. Stacks on mobile.
export const MediaTextConfig = z.object({
  mediaId: OptionalMediaRef,
  imageFit: ObjectFit.default('cover'),
  imageFocal: FocalPoint.default({ x: 50, y: 50 }),
  mediaSide: z.enum(['left', 'right']).default('right'),
  eyebrow: z.string().max(80).default(''),
  heading: z.string().max(160).default('A headline about this feature'),
  body: z
    .string()
    .max(1200)
    .default('Use this space to explain a single idea — what it is and why it matters.'),
  ctas: ctas([]),
  background: z.enum(['default', 'subtle']).default('subtle'),
  sectionHeight: SectionHeight.default('auto'),
  // Break the grid out of the section container so the image column runs edge-to-edge.
  fullBleed: z.boolean().default(false),
});
export type MediaTextConfig = z.infer<typeof MediaTextConfig>;

export const mediaTextFields: SectionField[] = [
  mediaField('mediaId', 'Image', undefined, {
    fitKey: 'imageFit',
    focalKey: 'imageFocal',
  }),
  {
    key: 'mediaSide',
    label: 'Image side',
    type: 'select',
    options: [
      { label: 'Left', value: 'left' },
      { label: 'Right', value: 'right' },
    ],
  },
  { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
  { key: 'heading', label: 'Heading', type: 'text' },
  { key: 'body', label: 'Body', type: 'textarea' },
  ctasField(),
  {
    key: 'background',
    label: 'Background',
    type: 'select',
    options: [
      { label: 'Subtle', value: 'subtle' },
      { label: 'Default', value: 'default' },
    ],
  },
  sectionHeightField(),
  { key: 'fullBleed', label: 'Full-bleed (edge to edge)', type: 'boolean' },
];
