import { z } from 'zod';
import {
  Align,
  FocalPoint,
  ObjectFit,
  OptionalMediaRef,
  ctas,
  ctasField,
  mediaField,
} from '../common';
import type { SectionField } from '../fields';

export const ImageBannerConfig = z.object({
  imageMediaId: OptionalMediaRef,
  imageFit: ObjectFit.default('cover'),
  imageFocal: FocalPoint.default({ x: 50, y: 50 }),
  eyebrow: z.string().max(80).default(''),
  heading: z.string().max(160).default('Your banner headline'),
  subheading: z.string().max(300).default(''),
  ctas: ctas([{ label: 'Learn more', url: '/products', style: 'solid' }]),
  align: Align.default('left'),
  // `split` pins the title block to the top and the CTAs to the bottom (the
  // full-screen "model name up top, buttons down low" hero treatment).
  verticalAlign: z.enum(['top', 'center', 'bottom', 'split']).default('center'),
  height: z.enum(['sm', 'md', 'lg', 'screen']).default('md'),
  // Break out of the centered content container to a full-bleed band.
  fullBleed: z.boolean().default(false),
  textColor: z.enum(['auto', 'light', 'dark']).default('auto'),
  overlayOpacity: z.number().int().min(0).max(100).default(35),
});
export type ImageBannerConfig = z.infer<typeof ImageBannerConfig>;

export const imageBannerFields: SectionField[] = [
  mediaField('imageMediaId', 'Image', undefined, { fitKey: 'imageFit', focalKey: 'imageFocal' }),
  { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
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
      { label: 'Split (title top, buttons bottom)', value: 'split' },
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
  { key: 'fullBleed', label: 'Full-bleed (edge to edge)', type: 'boolean' },
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
