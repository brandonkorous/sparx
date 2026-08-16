/**
 * Color maths for the palette maker and the contrast checker.
 *
 * Pure functions, no DOM, no dependencies. Every formula here is from a
 * published specification rather than tuned by eye, and the ones that are easy
 * to get subtly wrong carry the reason inline — a contrast function that is
 * wrong by a little is worse than one that is wrong by a lot, because nobody
 * notices.
 *
 * One file per concern; this one only re-exports, so `./lib/color` still resolves
 * for every caller that imported it when it was a single module.
 */
export { clamp, hslToRgb, parseHex, rgbToHsl, toHex, type Hsl, type Rgb } from './convert';
export {
    contrastRatio,
    gradeContrast,
    readableInk,
    relativeLuminance,
    type ContrastVerdict,
} from './contrast';
export { harmony, HARMONY_LABELS, type HarmonyKind } from './harmony';
export { ramp, RAMP_STEPS, type RampStep } from './ramp';
export { describeColor } from './describe';
