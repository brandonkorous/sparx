// Can the words actually be read?
//
// THE FAILURE THIS EXISTS FOR. Contrast is the one design mistake whose victim is
// never the person making it. The author picked the colors on a good monitor, in a
// dark room, knowing what the words say — so pale grey on white looks refined rather
// than unreadable. On a phone in sunlight, or to anyone whose eyes are older than the
// designer's, the same text is simply gone. Nobody reports it; they leave. No builder
// in the comparison set checks it before publishing, and the platform is in a better
// position to than any of them, because it owns the theme AND the class vocabulary and
// can therefore resolve a color without ever rendering the page.
//
// TWO RULES, BECAUSE THERE ARE TWO DECISIONS.
//
//   1. THE THEME'S OWN PAIRS, checked once. Every silicaui component variant pairs a
//      color with its `-content` foreground: `btn-primary` is `--color-primary`
//      against `--color-primary-content`, and so are `badge-primary`, `alert-primary`
//      and every other. That pairing is decided ONCE, in the theme, and it is wrong or
//      right for the entire site at once. Checking it per node would produce thousands
//      of copies of one fact; checking the theme produces one finding that fixes all
//      of them. It is also the only way to catch a variant on a page nobody linted.
//
//   2. THE AUTHOR'S OWN PAIRINGS, per node. `bg-primary` with the default ink on it,
//      `text-base-300` on `bg-base-100`, a `soft` tint under text that assumed a white
//      surface. These are chosen per element and can only be found by walking.
//
// WHAT IS DELIBERATELY NOT JUDGED. Anything whose painted color this engine cannot
// name with certainty: an opacity suffix over an unknown backdrop, a gradient, a
// `glass` surface, a component painting its own background with no authored override.
// `paint.ts` marks those unknown and they are skipped. That is the same bias as every
// other rule here — a false "your page is unreadable" costs more than a miss.

import type { DocumentInventory, VisitedNode } from './walk';
import { isBound, visibleText } from './walk';
import { isLargeText, type PaintContext } from './paint';
import { contrastOf, paletteOf, type Palette, type Rgb } from './palette';
import type { RawFinding } from './finding';
import type { LintSeverity } from './types';
import type { Theme } from '@wizeworks/silicaui-html';

/** WCAG 2.2 AA. 4.5:1 for body copy, 3:1 for large text — and below 3:1 nothing is
 *  legible at any size, which is the line between "hard to read" and "invisible". */
const AA_NORMAL = 4.5;
const AA_LARGE = 3;

/** Round for display: `2.1` reads as a measurement, `2.0999999` reads as a bug. */
function ratio(value: number): string {
  return `${(Math.round(value * 10) / 10).toFixed(1)}:1`;
}

function hex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** Both modes when the theme carries a dark delta, else the one it expresses. A site
 *  with a dark theme genuinely renders both ways depending on the visitor's system
 *  setting, so checking only one of them checks half the site. */
function modesOf(theme: Theme): ('light' | 'dark')[] {
  const declared = theme.mode ?? 'light';
  if (!theme.dark || Object.keys(theme.dark).length === 0) return [declared];
  return ['light', 'dark'];
}

/** Name the mode only when there is more than one to name — "in dark mode" on a site
 *  with no dark mode is a sentence about something the owner has never seen. */
function inMode(palette: Palette, modes: readonly string[]): string {
  return modes.length > 1 ? ` in ${palette.mode} mode` : '';
}

/* ── 1. The theme's own pairs ───────────────────────────────────────────────── */

/**
 * Every color the theme defines, against the foreground silicaui puts on it.
 *
 * A `derived` pair is one silicaui computed itself — white or black, whichever the
 * color's lightness calls for. Those very rarely fail, and when they do the fix is
 * different (pick a different color, or set the foreground explicitly), so the
 * finding says so rather than telling the owner to change a token they never set.
 */
function checkThemePairs(
  palette: Palette,
  used: ReadonlySet<string>,
  modes: readonly string[]
): RawFinding[] {
  const findings: RawFinding[] = [];

  for (const pair of palette.pairs()) {
    // Only colors the site actually PAINTS WITH. A theme carries eight semantic roles
    // and most sites use three; reporting the other five is reporting a problem the
    // owner does not have, on a page that does not exist, about a color they have
    // never picked. Restricting to real use also makes each finding answerable —
    // "your Buy button is 4.1:1" is a thing to go and look at.
    if (!used.has(pair.name)) continue;
    const value = contrastOf(pair.color, pair.content);
    // A theme color carries buttons, badges and alerts — solid blocks of color with a
    // label on them, which is the large-text case only when the label is large. Held
    // to the body-copy bar because a badge is small text by definition.
    if (value >= AA_NORMAL) continue;

    const severity: LintSeverity = value < AA_LARGE ? 'error' : 'warning';
    findings.push({
      origin: { scope: 'site', ownerId: null, ownerName: 'Your colors' },
      nodeId: null,
      nodePath: '',
      rule: value < AA_LARGE ? 'contrast-unreadable' : 'contrast-low',
      severity,
      title: `Text on your ${pair.name} color is hard to read`,
      detail:
        `Anything using your ${pair.name} color as a background — buttons, labels, ` +
        `highlighted panels — puts ${hex(pair.content)} text on ${hex(pair.color)}, which is ` +
        `${ratio(value)}. Comfortable reading needs about ${String(AA_NORMAL)}:1. ` +
        (pair.derived
          ? 'No text color was chosen for this one, so the darkest or lightest option was ' +
            'picked automatically and it still is not enough — the colour itself is in the ' +
            'middle of the range, where neither black nor white reads well. Choose a deeper ' +
            'or lighter version of it, or set its text color yourself.'
          : 'The text color set for it is too close in tone. Make one of the two much darker ' +
            'or much lighter.') +
        ` This is a single change in your theme${inMode(palette, modes)}, and it fixes every ` +
        'place the color is used at once.',
      evidence: `${pair.name} ${ratio(value)}${modes.length > 1 ? ` (${palette.mode})` : ''}`,
    });
  }

  return findings;
}

/* ── 2. The author's own pairings ───────────────────────────────────────────── */

/** The background a node is actually painted on, or null when it cannot be named. */
function backgroundOf(paint: PaintContext, palette: Palette): Rgb | null {
  if (paint.backgroundUnknown) return null;
  if (paint.backgroundSoft) return palette.softBackground(paint.softAccent ?? 'base-content');
  if (paint.background) return palette.color(paint.background);
  return palette.surface;
}

/** The ink a node's words are painted in, or null when it cannot be named. */
function foregroundOf(paint: PaintContext, palette: Palette): Rgb | null {
  if (paint.textUnknown) return null;
  if (paint.text) return palette.color(paint.text);
  return palette.ink;
}

/** Does this node paint words of its own? Only the node that directly holds the text
 *  is judged — its color and size are the ones that apply, and walking up from every
 *  descendant would report one sentence once per wrapper around it. */
function holdsText(visited: VisitedNode): boolean {
  const { node } = visited;
  if (isBound(node)) return true;
  return (node.children ?? []).some(
    (child) => typeof child === 'string' && child.trim().length > 0
  );
}

function checkAuthoredPairs(
  inventory: DocumentInventory,
  palette: Palette,
  modes: readonly string[]
): RawFinding[] {
  const findings: RawFinding[] = [];

  for (const visited of inventory.nodes) {
    if (!holdsText(visited)) continue;
    const { paint } = visited;

    // `bg-primary` + `text-primary-content` is not an authoring decision — it is the
    // theme's own pair, written out by hand. Checking it here as well would report the
    // same fact twice with two different fixes attached: once as "change your theme"
    // and once as "change this element", the second of which is wrong. The pair is
    // reported once, at site scope, by `checkThemePairs`.
    if (paint.background && paint.text === `${paint.background}-content` && !paint.backgroundSoft) {
      continue;
    }

    const background = backgroundOf(paint, palette);
    const foreground = foregroundOf(paint, palette);
    if (!background || !foreground) continue;

    const large = isLargeText(paint);
    const required = large ? AA_LARGE : AA_NORMAL;
    const value = contrastOf(background, foreground);
    if (value >= required) continue;

    const words = visibleText(visited.node).slice(0, 60);
    findings.push({
      origin: visited.origin,
      nodeId: visited.node.id ?? null,
      nodePath: visited.nodePath,
      rule: value < AA_LARGE ? 'contrast-unreadable' : 'contrast-low',
      severity: value < AA_LARGE ? 'error' : 'warning',
      title:
        value < AA_LARGE
          ? 'These words are almost invisible against what is behind them'
          : 'These words are hard to read against what is behind them',
      detail:
        `The text is ${hex(foreground)} on ${hex(background)}, which is ${ratio(value)}. ` +
        `${large ? 'Large text like this' : 'Text at this size'} needs about ` +
        `${String(required)}:1 to stay comfortable on a phone screen in daylight, or for anyone ` +
        `who does not see fine contrast well. Either darken or lighten the text, or change ` +
        `what is behind it${inMode(palette, modes)}. ` +
        (paint.backgroundSoft
          ? 'The background here is a soft tint, which is much paler than the colour it is ' +
            'made from — text chosen for the solid colour will not carry on it.'
          : ''),
      evidence: `${ratio(value)}${words ? ` — "${words}"` : ''}${
        modes.length > 1 ? ` (${palette.mode})` : ''
      }`,
    });
  }

  return findings;
}

/* ── The rule ───────────────────────────────────────────────────────────────── */

/**
 * Per-page contrast findings. Returns nothing without a theme: the whole check is
 * "what do these token names paint", and with no theme there is no answer — inventing
 * a default one would judge a site against colors it does not use.
 */
export function checkContrast(
  inventory: DocumentInventory,
  theme: Theme | null | undefined
): RawFinding[] {
  if (!theme) return [];
  const modes = modesOf(theme);
  return modes.flatMap((mode) => checkAuthoredPairs(inventory, paletteOf(theme, mode), modes));
}

/**
 * Class prefixes that put a theme color BEHIND text — the plain color utility plus
 * every silicaui component whose `-<color>` variant fills a block and drops the
 * matching `-content` foreground onto it.
 *
 * `text-primary` is deliberately absent: that is the color in FRONT, judged per node
 * against whatever it sits on, not as a pair with itself.
 */
const SURFACE_PREFIXES = new Set([
  'bg',
  'btn',
  'badge',
  'alert',
  'tab',
  'step',
  'progress',
  'toggle',
  'checkbox',
  'radio',
  'range',
  'menu',
  'navbar',
  'footer',
  'card',
  'chat',
  'dock',
  'timeline',
  'stat',
]);

/**
 * Which theme colors this site paints WITH — read off the class strings of every node
 * in every page's composed document, variants included (a color used only at one
 * breakpoint is still used).
 */
export function usedSurfaceColors(
  inventories: readonly DocumentInventory[],
  palette: Palette
): Set<string> {
  const used = new Set<string>();
  for (const inventory of inventories) {
    for (const visited of inventory.nodes) {
      for (const raw of (visited.node.class ?? '').split(/\s+/)) {
        const token = raw.slice(raw.lastIndexOf(':') + 1);
        const dash = token.indexOf('-');
        if (dash <= 0) continue;
        const prefix = token.slice(0, dash);
        const name = token.slice(dash + 1);
        if (!SURFACE_PREFIXES.has(prefix)) continue;
        if (palette.color(name) && palette.color(`${name}-content`)) used.add(name);
      }
    }
  }
  return used;
}

/** Site-wide contrast findings — the theme's own color/foreground pairs, checked once
 *  rather than once per element that happens to use them. */
export function checkThemeContrast(
  theme: Theme | null | undefined,
  inventories: readonly DocumentInventory[]
): RawFinding[] {
  if (!theme) return [];
  const modes = modesOf(theme);
  return modes.flatMap((mode) => {
    const palette = paletteOf(theme, mode);
    return checkThemePairs(palette, usedSurfaceColors(inventories, palette), modes);
  });
}
