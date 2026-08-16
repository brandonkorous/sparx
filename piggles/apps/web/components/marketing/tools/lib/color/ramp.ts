import { clamp, hslToRgb, rgbToHsl, toHex, type Rgb } from './convert';

export const RAMP_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type RampStep = (typeof RAMP_STEPS)[number];

/**
 * Target lightness for each step.
 *
 * A ramp built by evenly dividing lightness looks wrong: the pale end changes
 * imperceptibly while the dark end falls off a cliff, because perceived
 * brightness is not linear in HSL lightness. These values are weighted towards
 * the light end to compensate, which is what makes 50 and 100 read as two
 * distinct backgrounds rather than as the same near-white twice.
 *
 * Saturation also drops at both extremes. A very pale color at full saturation
 * looks like a highlighter, and a very dark one looks like ink rather than like
 * a dark version of the color you chose.
 */
const RAMP: Record<RampStep, { l: number; sMul: number }> = {
    50: { l: 97, sMul: 0.55 },
    100: { l: 94, sMul: 0.7 },
    200: { l: 87, sMul: 0.82 },
    300: { l: 78, sMul: 0.9 },
    400: { l: 67, sMul: 0.96 },
    500: { l: 56, sMul: 1 },
    600: { l: 47, sMul: 1 },
    700: { l: 39, sMul: 0.96 },
    800: { l: 31, sMul: 0.9 },
    900: { l: 24, sMul: 0.84 },
    950: { l: 15, sMul: 0.78 },
};

export function ramp(base: Rgb): Record<RampStep, string> {
    const { h, s } = rgbToHsl(base);
    const out = {} as Record<RampStep, string>;
    for (const step of RAMP_STEPS) {
        const { l, sMul } = RAMP[step];
        out[step] = toHex(hslToRgb({ h, s: clamp(s * sMul, 0, 100), l }));
    }
    return out;
}
