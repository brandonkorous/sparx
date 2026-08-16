import { parseHex, relativeLuminance, toHex, type Rgb } from '../lib/color';

/**
 * What the palette looks like to somebody who does not see colour the way you
 * do.
 *
 * Around one man in twelve has some form of colour blindness, so a palette whose
 * "success green" and "danger red" collapse into the same mustard is not an edge
 * case — it is roughly one customer in twenty-five reading a status they cannot
 * tell apart. Checking it is a switch; not checking it is a support ticket.
 */
export type Vision = 'normal' | 'protan' | 'deutan' | 'tritan' | 'mono';

export const VISIONS: Record<Vision, { label: string; blurb: string }> = {
  normal: { label: 'Normal vision', blurb: 'The palette as most people see it.' },
  deutan: {
    label: 'Green-blind',
    blurb: 'Deuteranopia — the most common, about 1 man in 16. Reds and greens converge.',
  },
  protan: {
    label: 'Red-blind',
    blurb: 'Protanopia. Reds darken and slide towards the greens beside them.',
  },
  tritan: { label: 'Blue-blind', blurb: 'Tritanopia. Rare, and it flattens blues into greens.' },
  mono: { label: 'No colour at all', blurb: 'Also what a black-and-white printout does to it.' },
};

/**
 * Machado, Oliveira & Fernandes (2009), severity 1.0.
 *
 * They operate on LINEAR light, not on the bytes. Applying them to gamma-encoded
 * channels is the usual mistake and produces results that look plausible and are
 * meaningfully wrong — it under-states the collapse, which defeats the point of
 * running the check.
 */
const MATRICES: Record<Exclude<Vision, 'normal' | 'mono'>, number[]> = {
  protan: [
    0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998,
  ],
  deutan: [
    0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881,
  ],
  tritan: [
    1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039,
  ],
};

const toLinear = (v: number): number => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const toByte = (v: number): number => {
  const clamped = Math.min(1, Math.max(0, v));
  const s = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return Math.round(s * 255);
};

export function simulate(rgb: Rgb, vision: Vision): Rgb {
  if (vision === 'normal') return rgb;

  if (vision === 'mono') {
    const grey = toByte(relativeLuminance(rgb));
    return { r: grey, g: grey, b: grey };
  }

  const m = MATRICES[vision];
  const [r, g, b] = [toLinear(rgb.r), toLinear(rgb.g), toLinear(rgb.b)];
  return {
    r: toByte(m[0]! * r + m[1]! * g + m[2]! * b),
    g: toByte(m[3]! * r + m[4]! * g + m[5]! * b),
    b: toByte(m[6]! * r + m[7]! * g + m[8]! * b),
  };
}

/** Hex in, hex out — what every caller actually wants, since the palette is
 *  stored and painted as hex. Unparseable input is handed straight back rather
 *  than becoming black. */
export function seenAs(hex: string, vision: Vision): string {
  if (vision === 'normal') return hex;
  const rgb = parseHex(hex);
  return rgb ? toHex(simulate(rgb, vision)) : hex;
}
