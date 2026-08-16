import { parseHex, readableInk, toHex } from './color';
import type { LoadedImage } from './canvas';

/**
 * Drawing the 1200 × 630 card that appears when somebody posts your link.
 *
 * Drawn to a canvas rather than composed in the DOM and screenshotted, because
 * the output has to be an exact pixel size regardless of the screen it was made
 * on — and because a canvas can be exported at full resolution while being
 * previewed at a third of it.
 *
 * ── NO GRADIENTS ────────────────────────────────────────────────────────────
 *
 * The genre default for this is a diagonal wash behind white text, and it is
 * banned here for the same reason it is banned everywhere else in Piggles: it is
 * the single clearest sign a thing was generated rather than designed. Solid
 * colour, a real typographic hierarchy, and one confident accent do the job and
 * do not look like everybody else's card.
 */

export type CardLayout = 'left' | 'centre' | 'split';

export const CARD_LAYOUTS: { value: CardLayout; label: string; blurb: string }[] = [
  {
    value: 'left',
    label: 'Left',
    blurb: 'Everything ranged left, with a colour bar down the side. Reads like a headline.',
  },
  {
    value: 'centre',
    label: 'Centred',
    blurb: 'Middle of the card, plenty of air. Best for short titles.',
  },
  {
    value: 'split',
    label: 'Split',
    blurb: 'A solid colour panel on the left, the words on the right.',
  },
];

export interface CardInput {
  title: string;
  subtitle: string;
  /** The business name in the corner. */
  footer: string;
  background: string;
  accent: string;
  layout: CardLayout;
  logo: LoadedImage | null;
}

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

/**
 * Fit a headline to the space by trying sizes until one works.
 *
 * The alternative — picking a size from the character count — gets it wrong for
 * anything with unusual letter widths, and "WWW Manchester" and "illiterati" are
 * nothing alike at the same length. Measuring is exact, and the loop runs in
 * microseconds because there are only a dozen candidate sizes.
 */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  opts: { maxWidth: number; maxHeight: number; weight: string; family: string; sizes: number[] }
): { size: number; lines: string[]; lineHeight: number } {
  for (const size of opts.sizes) {
    ctx.font = `${opts.weight} ${size}px ${opts.family}`;
    const lineHeight = size * 1.14;

    const lines: string[] = [];
    let line = '';
    let fits = true;

    for (const word of text.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= opts.maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      // One word wider than the whole card — no size in the list will fit it, so
      // let the smallest win and accept the overflow rather than looping forever.
      if (ctx.measureText(word).width > opts.maxWidth) fits = false;
      line = word;
    }
    if (line) lines.push(line);

    if (fits && lines.length * lineHeight <= opts.maxHeight) return { size, lines, lineHeight };
  }

  const size = opts.sizes.at(-1)!;
  ctx.font = `${opts.weight} ${size}px ${opts.family}`;
  return { size, lines: [text], lineHeight: size * 1.14 };
}

/** next/font hashes the family, so a literal name never resolves on a canvas.
 *  Read the token off the element — same source of truth as every heading. */
function headingFamily(el: HTMLElement): string {
  const token = getComputedStyle(el).getPropertyValue('--font-heading').trim();
  return token || "'Fredoka', 'Inter', system-ui, sans-serif";
}

export function drawShareCard(canvas: HTMLCanvasElement, input: CardInput): void {
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const family = headingFamily(canvas);

  const bg = parseHex(input.background) ?? { r: 255, g: 255, b: 255 };
  const accent = parseHex(input.accent) ?? { r: 255, g: 111, b: 134 };
  // The text colour is MEASURED against the background rather than chosen, which
  // is the whole reason a pale-yellow card here comes out with dark text instead
  // of the white every template uses regardless.
  const ink = readableInk(bg);
  const inkHex = toHex(ink);
  const quiet = toHex({
    r: Math.round(ink.r * 0.65 + bg.r * 0.35),
    g: Math.round(ink.g * 0.65 + bg.g * 0.35),
    b: Math.round(ink.b * 0.65 + bg.b * 0.35),
  });

  ctx.fillStyle = toHex(bg);
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const PAD = 76;
  let textLeft = PAD;
  let textWidth = CARD_WIDTH - PAD * 2;
  let align: CanvasTextAlign = 'left';

  if (input.layout === 'left') {
    ctx.fillStyle = toHex(accent);
    ctx.fillRect(0, 0, 20, CARD_HEIGHT);
    textLeft = PAD + 20;
    textWidth = CARD_WIDTH - textLeft - PAD;
  } else if (input.layout === 'split') {
    const panel = 380;
    ctx.fillStyle = toHex(accent);
    ctx.fillRect(0, 0, panel, CARD_HEIGHT);
    textLeft = panel + PAD;
    textWidth = CARD_WIDTH - textLeft - PAD;

    if (input.logo) {
      const size = 190;
      const scale = Math.min(size / input.logo.width, size / input.logo.height);
      const w = input.logo.width * scale;
      const h = input.logo.height * scale;
      ctx.drawImage(input.logo.source, (panel - w) / 2, (CARD_HEIGHT - h) / 2, w, h);
    }
  } else {
    align = 'center';
    textLeft = CARD_WIDTH / 2;
  }

  // The logo sits top-left on the layouts that have room for it.
  let top = PAD;
  if (input.logo && input.layout !== 'split') {
    const size = 76;
    const scale = Math.min(size / input.logo.width, size / input.logo.height);
    const w = input.logo.width * scale;
    const h = input.logo.height * scale;
    ctx.drawImage(
      input.logo.source,
      align === 'center' ? (CARD_WIDTH - w) / 2 : textLeft,
      top,
      w,
      h
    );
    top += h + 34;
  }

  ctx.textAlign = align;
  ctx.textBaseline = 'top';

  const footerRoom = input.footer ? 74 : 0;
  const subtitleRoom = input.subtitle ? 110 : 0;
  const available = CARD_HEIGHT - top - PAD - footerRoom - subtitleRoom;

  const title = fitText(ctx, input.title || 'Your headline here', {
    maxWidth: textWidth,
    maxHeight: Math.max(available, 120),
    weight: '700',
    family,
    sizes: [86, 76, 68, 60, 54, 48, 42, 38],
  });

  // Vertically centred in what is left, rather than pinned to the top. A short
  // title pinned high leaves a card that looks unfinished.
  const blockHeight = title.lines.length * title.lineHeight + (input.subtitle ? 22 + 34 * 1.4 : 0);
  let y = top + Math.max(0, (CARD_HEIGHT - top - PAD - footerRoom - blockHeight) / 2);

  ctx.fillStyle = inkHex;
  for (const line of title.lines) {
    ctx.fillText(line, textLeft, y);
    y += title.lineHeight;
  }

  if (input.subtitle) {
    y += 22;
    ctx.font = `500 34px ${family}`;
    ctx.fillStyle = quiet;
    const words = input.subtitle.split(/\s+/);
    let line = '';
    const lines: string[] = [];
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= textWidth) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    for (const l of lines.slice(0, 2)) {
      ctx.fillText(l, textLeft, y);
      y += 34 * 1.4;
    }
  }

  if (input.footer) {
    ctx.font = `700 24px ${family}`;
    ctx.fillStyle = toHex(accent);
    ctx.textBaseline = 'alphabetic';
    // Always bottom-left, even on the centred layout: a centred footer reads as
    // a caption rather than as a signature.
    ctx.textAlign = input.layout === 'split' ? 'left' : 'left';
    ctx.fillText(
      input.footer,
      input.layout === 'split' ? textLeft : PAD + (input.layout === 'left' ? 20 : 0),
      CARD_HEIGHT - PAD + 8
    );
  }
}
