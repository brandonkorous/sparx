import { rgbToHsl, type Rgb } from './convert';

/**
 * Hue names, by the degree each family stops at.
 *
 * The rose end is where this goes wrong if the bands are drawn casually. Pink
 * runs to about 352° and only then becomes red — an earlier version cut it at
 * 345, which meant the Piggles pink itself (350°) was described as "light red"
 * on a page that had just painted it in front of you. A colour name that
 * disagrees with the swatch beside it makes the whole tool look like it is
 * guessing.
 */
const FAMILIES: [number, string][] = [
  [10, 'red'],
  [45, 'orange'],
  [68, 'yellow'],
  [155, 'green'],
  [195, 'teal'],
  [240, 'blue'],
  [275, 'indigo'],
  [310, 'purple'],
  [338, 'magenta'],
  [352, 'pink'],
  [360, 'red'],
];

/** A short, human name for a colour — "warm pink", "deep teal". Used as the
 *  swatch caption, because `#FF6F86` is not a thing anybody can hold in mind
 *  while comparing five of them. */
export function describeColor(rgb: Rgb): string {
  const { h, s, l } = rgbToHsl(rgb);
  if (s < 8) return l > 80 ? 'near white' : l < 18 ? 'near black' : 'grey';

  const family = FAMILIES.find(([max]) => h <= max)?.[1] ?? 'red';
  const weight = l > 78 ? 'pale ' : l > 62 ? 'light ' : l < 26 ? 'deep ' : l < 42 ? 'dark ' : '';
  const intensity = s > 78 && weight === '' ? 'vivid ' : '';
  return `${weight}${intensity}${family}`.trim();
}
