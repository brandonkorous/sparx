import { serializeBrandPalette } from '@wizeworks/site-themes/brand-palette';
import { buildPalette, hexToHsl, hslToHex, readableTextOn, type PaletteColor } from './lib/color';

/**
 * The four things the color tool hands you to take away: a silicaui theme, a
 * Tailwind color config, raw CSS variables, and the sparx Builder's own
 * interchange JSON. Split out of `palette-tool.tsx` because generating export
 * text is a separate job from driving the tool's UI — the component should not
 * grow a string-builder every time we add a target.
 */

/* ── silicaui theme ───────────────────────────────────────────────────────── */

/**
 * silicaui's semantic color slots, in the order a generated palette fills them.
 * Every colored silicaui object is built from a `{name}` + `{name}-content`
 * pair (the fill and the legible ink ON that fill), so both are always emitted;
 * `readableTextOn` picks the ink. Slots the palette doesn't reach are simply
 * left out — a partial theme inherits the rest of silicaui's defaults, which is
 * how themes are meant to compose. Anything past the fourth color has no
 * semantic slot left (`info`/`success`/`warning`/`error` mean status, not
 * brand), so it ships as a named extra with a note on how to register it.
 */
const SILICA_SLOTS = ['primary', 'secondary', 'accent', 'neutral'] as const;

/** Lift a color until it reads on a dark surface, keeping its hue. */
function forDarkMode(hex: string): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;
  return hslToHex({ h: hsl.h, s: Math.min(0.9, hsl.s), l: Math.max(hsl.l, 0.66) });
}

function slotFor(index: number, name: string): string {
  return SILICA_SLOTS[index] ?? `${name}-${index}`;
}

function themeBlock(
  selectors: string[],
  scheme: 'light' | 'dark',
  name: string,
  colors: PaletteColor[],
  transform: (hex: string) => string
): string[] {
  const lines = [...selectors.map((s, i) => (i === selectors.length - 1 ? `${s} {` : `${s},`))];
  lines.push(`  color-scheme: ${scheme};`);
  colors.forEach((c, i) => {
    const slot = slotFor(i, name);
    const fill = transform(c.hex).toLowerCase();
    if (i > 0) lines.push('');
    lines.push(`  /* ${c.role} */`);
    lines.push(`  --color-${slot}: ${fill};`);
    lines.push(`  --color-${slot}-content: ${readableTextOn(fill).toLowerCase()};`);
  });
  lines.push('}');
  return lines;
}

/**
 * The palette as a named silicaui theme — a light block and a dark one, each
 * answering to both its own name and the generic `light`/`dark` a theme toggle
 * writes, so it works the moment it is pasted in. The dark fills are the same
 * hues lifted until they read on a dark background.
 */
export function buildSilicaTheme(name: string, colors: PaletteColor[]): string {
  const extras = colors.length - SILICA_SLOTS.length;
  const header = [
    `/* ${name} — a color theme for silicaui (silicaui.com).`,
    ' * Paste into your stylesheet. Each color has a matching "-content" value:',
    ' * the text color that stays readable on top of it.',
  ];
  if (extras > 0) {
    header.push(
      ` * The last ${extras === 1 ? 'color uses a name' : `${extras} colors use names`} silicaui does`,
      " * not ship by default — add them to your silicaui plugin's `colors:` list",
      ' * to use them as button, badge, and card colors. */'
    );
  } else {
    header.push(' */');
  }

  return [
    ...header,
    ...themeBlock(
      [`[data-theme='${name}']`, "[data-theme='light']"],
      'light',
      name,
      colors,
      (h) => h
    ),
    '',
    ...themeBlock(
      [`[data-theme='${name}-dark']`, "[data-theme='dark']"],
      'dark',
      name,
      colors,
      forDarkMode
    ),
  ].join('\n');
}

/* ── sparx Builder interchange ────────────────────────────────────────────── */

/**
 * The sparx interchange export — the same palette as a `sparx.brand-palette`
 * JSON that the Builder's brand importer can paste-apply. Content (foreground)
 * colors are the WCAG-readable pick for each fill. Shares one format module
 * with the dashboard, so the two never drift.
 */
export function buildSparxExport(name: string, colors: PaletteColor[]): string {
  const toColor = (c: PaletteColor) => ({ fill: c.hex, content: readableTextOn(c.hex) });
  return serializeBrandPalette({
    name,
    source: 'https://sparx.works/tools/color-palette',
    primary: toColor(colors[0]!),
    accents: colors.slice(1).map(toColor),
  });
}

/* ── CSS variables + Tailwind ─────────────────────────────────────────────── */

/**
 * Build the export strings. Every color — primary and each accent — ships as a
 * full 50–950 ramp so the whole palette is dev-ready, not just the primary.
 * The primary uses the bare name; accents are suffixed `-accent-1`, `-accent-2`…
 */
export function buildExports(
  name: string,
  colors: PaletteColor[]
): { css: string; tailwind: string } {
  const cssLines: string[] = [':root {'];
  const twLines: string[] = ['colors: {'];

  colors.forEach((c, i) => {
    const key = i === 0 ? name : `${name}-accent-${i}`;
    const ramp = buildPalette(c.hex);

    if (i > 0) cssLines.push('');
    cssLines.push(`  /* ${c.role} */`);
    ramp.forEach((s) => cssLines.push(`  --${key}-${s.step}: ${s.hex.toLowerCase()};`));

    twLines.push(i === 0 ? `  ${name}: {` : `  '${name}-accent-${i}': {`);
    ramp.forEach((s) => twLines.push(`    ${s.step}: '${s.hex.toLowerCase()}',`));
    twLines.push('  },');
  });

  cssLines.push('}');
  twLines.push('}');
  return { css: cssLines.join('\n'), tailwind: twLines.join('\n') };
}
