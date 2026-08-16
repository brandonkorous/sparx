import { contentFor, ROLE_ORDER, ROLE_JOBS, type Assignment } from './roles';
import type { Palette } from './model';

/**
 * The palette as something you can paste.
 *
 * Named by silica ROLE, not by position — `--primary` and `--base-100` are the
 * names on the swatches and in the legend, and they survive somebody reordering
 * the palette an hour later. `--colour-3` does neither. Anything no role claimed
 * keeps a number, because inventing a name for it would be a guess.
 *
 * Every named line carries the job it does as a comment, so the file explains
 * itself to whoever opens it next without them having to come back here.
 *
 * ── ONE LINE PER COLOUR, AND NOTHING ELSE ───────────────────────────────────
 *
 * This also emitted `--primary-50` through `--primary-950` and no ramp for the
 * other five roles, which is a rule that only applies to one thing — so it is
 * not a rule, it is a leftover. The 50–950 range is still there to explore on
 * any swatch's shades rail, where every colour gets it equally; what leaves the
 * page is the palette somebody actually chose.
 */

/** `[variable name, hex, the job it does]`. */
type Named = [string, string, string | null];

/**
 * One line per slot, in slot order, then any spares past the sixth.
 *
 * Read off the ROLES rather than off the swatches, because the value a slot
 * exports is not always the colour sitting in it: `base-content` is darkened
 * when nothing in the palette is readable on the page. The plain-CSS export was
 * emitting the original while the silicaui export emitted the corrected one, so
 * the two disagreed on the single most important value in the theme.
 */
/**
 * Unlike the silicaui export, these DO write every `-content` out.
 *
 * Silica derives a legible ink for anything a theme leaves undeclared, so its
 * block should only carry decisions. Plain CSS derives nothing: a `--primary`
 * with no `--primary-content` beside it leaves whoever pastes this to guess what
 * goes on top, which is the question the whole tool exists to answer.
 */
function named(palette: Palette, roles: Assignment): Named[] {
  const slots = ROLE_ORDER.filter((_, i) => i < palette.length).flatMap((role): Named[] => {
    const pair = contentFor(role, roles);
    return [
      [role, roles[role], ROLE_JOBS[role]],
      [pair.name, pair.hex, `Text on ${role}`],
    ];
  });

  return [
    ...slots,
    ...palette
      .slice(ROLE_ORDER.length)
      .map((swatch, i): Named => [`colour-${ROLE_ORDER.length + i + 1}`, swatch.hex, null]),
  ];
}

const line = (prefix: string, [name, hex, job]: Named): string =>
  `  ${prefix}${name}: ${hex};${job ? `  /* ${job} */` : ''}`;

export function cssVars(palette: Palette, roles: Assignment): string {
  const body = named(palette, roles).map((n) => line('--', n));
  return `:root {\n${body.join('\n')}\n}`;
}

export function tailwindTheme(palette: Palette, roles: Assignment): string {
  const body = named(palette, roles).map((n) => line('--color-', n));
  return `@theme {\n${body.join('\n')}\n}`;
}

export function scssVars(palette: Palette, roles: Assignment): string {
  return named(palette, roles)
    .map(([name, hex, job]) => `$${name}: ${hex};${job ? ` // ${job}` : ''}`.trim())
    .join('\n');
}

export function plainList(palette: Palette): string {
  return palette.map((s) => s.hex).join('\n');
}
