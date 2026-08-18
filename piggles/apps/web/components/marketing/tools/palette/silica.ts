import { parseHex, toHex, type Rgb } from '../lib/color';
import {
  inkName,
  ROLE_ORDER,
  ROLE_JOBS,
  INK_ROLES,
  type Assignment,
  type ContentInk,
} from './roles';
import type { Palette } from './model';

/**
 * The palette as a silicaui theme.
 *
 * This is the export that does the most and asks for the least. A silica theme
 * is a set of tokens applied through one `data-theme` attribute, so pasting this
 * block re-colors every button, badge, input, tab, alert and focus ring at once
 * — there is nothing else to change and no component to restyle. The names match
 * the swatches and the legend exactly, because they are the same names.
 *
 * TWO THINGS IT DELIBERATELY DOES NOT EMIT:
 *
 *   • `--color-*-content` that nobody chose. Silica derives the legible ink on
 *     every role by MEASURED contrast, and a pair written out by hand goes stale
 *     the moment the role color changes. An ink the visitor OVERRODE is a
 *     different thing — that is a decision, it will not be re-derived, and it is
 *     emitted for exactly that reason.
 *   • `info` / `success` / `warning` / `error`. They already mean something, and
 *     a green pulled out of a brand palette landing on `error` is a worse answer
 *     than leaving silica's own.
 */
const SILICA_DEFAULT_COLORS = 'primary, secondary, accent, neutral, info, success, warning, error';

const mix = (a: Rgb, b: Rgb, t: number): Rgb => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
});

/** The two surfaces under the page surface. Silica wants three base steps, and a
 *  palette almost never contains three near-identical pale tones — they are
 *  `base-100` walked a little way towards the ink, which is what they are for. */
function baseSteps(roles: Assignment): [string, string] {
  const surface = parseHex(roles['base-100']);
  const content = parseHex(roles['base-content']);
  if (!surface || !content) return [roles['base-100'], roles['base-100']];
  return [toHex(mix(surface, content, 0.05)), toHex(mix(surface, content, 0.13))];
}

/** Swatches no role claimed. They are still part of the palette, and a color
 *  silica has not been told about renders as nothing at all — `btn-color-5`
 *  compiles, lints, and paints an unstyled button. */
function extras(palette: Palette): [string, string][] {
  return palette
    .slice(ROLE_ORDER.length)
    .map((s, i): [string, string] => [`color-${ROLE_ORDER.length + i + 1}`, s.hex]);
}

const token = (name: string, hex: string, job: string): string =>
  `  --color-${name}: ${hex};   /* ${job} */`;

/** An ink is written out only where somebody overrode it — everything else is
 *  silica's to measure, and stays right when the role color changes.
 *  `base-content` is the exception and is always emitted above, because it is a
 *  surface token the theme is expected to state rather than a derived pair. */
export function inkLines(ink: ContentInk): string[] {
  const chosen = INK_ROLES.filter((role) => role !== 'base-100' && ink[role]);
  if (chosen.length === 0) return [];
  return [
    ``,
    `  /* Only the inks you chose. Silica works the rest out by measured contrast. */`,
    ...chosen.map((role) => `  --color-${inkName(role)}: ${ink[role]!};`),
  ];
}

export function silicaTheme(
  palette: Palette,
  roles: Assignment,
  ink: ContentInk,
  name = 'mybrand'
): string {
  const [base200, base300] = baseSteps(roles);
  const extra = extras(palette);

  const theme = [
    `@plugin "@wizeworks/silicaui/theme" {`,
    `  name: ${name};`,
    `  color-scheme: light;`,
    `  default: true;`,
    ``,
    token('base-100', roles['base-100'], ROLE_JOBS['base-100']),
    `  --color-base-200: ${base200};`,
    `  --color-base-300: ${base300};`,
    token('base-content', roles['base-content'], 'The writing'),
    ``,
    token('primary', roles.primary, ROLE_JOBS.primary),
    token('secondary', roles.secondary, ROLE_JOBS.secondary),
    token('accent', roles.accent, ROLE_JOBS.accent),
    token('neutral', roles.neutral, ROLE_JOBS.neutral),
    ...inkLines(ink),
    `}`,
  ];

  if (extra.length === 0) return theme.join('\n');

  return [
    // The `colors:` list REPLACES silica's default set rather than extending it,
    // so every built-in still wanted has to be re-listed. Omitting one is how a
    // `<Badge color="warning">` comes out colorless.
    `@plugin "@wizeworks/silicaui" {`,
    `  colors: ${SILICA_DEFAULT_COLORS}, ${extra.map(([n]) => n).join(', ')};`,
    `}`,
    ``,
    `@theme {`,
    ...extra.map(([n, hex]) => `  --color-${n}: ${hex};`),
    `}`,
    ``,
    ...theme,
  ].join('\n');
}
