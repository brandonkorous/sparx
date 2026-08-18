/**
 * Renders a 1200×630 Open Graph / Twitter card to a canvas — an editorial,
 * left-aligned layout (eyebrow, auto-fit headline with an accent "spark", a
 * footer site name, an optional logo, and a soft accent glow). The title font
 * size auto-shrinks to fit, so a 4-word or 14-word headline both look composed.
 */
import { loadImageFromUrl } from './canvas';

export interface OgOptions {
  title: string;
  eyebrow: string;
  siteName: string;
  accent: string;
  theme: 'light' | 'dark';
  logo: string | null;
}

const W = 1200;
const H = 630;
const PAD = 80;

function hexAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(99,102,241,${alpha})`;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Draw the full card. Awaits webfonts + the logo so output matches preview. */
export async function renderOgCanvas(canvas: HTMLCanvasElement, opts: OgOptions): Promise<void> {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  try {
    await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
  } catch {
    /* fonts API unavailable — fall back to system metrics */
  }

  const dark = opts.theme === 'dark';
  const bg = dark ? '#0A0A0A' : '#FFFFFF';
  const fg = dark ? '#FFFFFF' : '#0A0A0A';
  const muted = dark ? '#A1A1AA' : '#71717A';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W - 120, 120, 0, W - 120, 120, 560);
  glow.addColorStop(0, hexAlpha(opts.accent, dark ? 0.26 : 0.16));
  glow.addColorStop(1, hexAlpha(opts.accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = 'top';
  let cursorY = PAD;

  if (opts.eyebrow.trim()) {
    ctx.font = '600 22px Geist, Inter, system-ui, sans-serif';
    ctx.fillStyle = opts.accent;
    ctx.fillText(opts.eyebrow.toUpperCase(), PAD, cursorY);
    cursorY += 46;
  } else {
    cursorY += 14;
  }

  if (opts.logo) {
    try {
      const img = await loadImageFromUrl(opts.logo);
      const maxH = 76;
      const scale = Math.min(maxH / img.height, 300 / img.width);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, W - PAD - w, PAD, w, h);
    } catch {
      /* ignore a logo that fails to decode */
    }
  }

  const maxWidth = W - PAD * 2;
  const titleTop = cursorY;
  const maxHeight = H - titleTop - 120;
  const title = opts.title.trim() || 'Your headline goes here';

  let size = 88;
  let lines: string[] = [];
  for (; size >= 40; size -= 3) {
    ctx.font = `600 ${size}px Geist, Inter, system-ui, sans-serif`;
    lines = wrapText(ctx, title, maxWidth);
    if (lines.length * size * 1.12 <= maxHeight) break;
  }

  ctx.fillStyle = fg;
  ctx.font = `600 ${size}px Geist, Inter, system-ui, sans-serif`;
  const lineHeight = size * 1.12;
  lines.forEach((line, i) => {
    ctx.fillText(line, PAD, titleTop + i * lineHeight);
    // Brand "spark" — only when the headline doesn't already end in punctuation,
    // so a user's trailing period never doubles up.
    if (i === lines.length - 1 && !/[.!?:]$/.test(line)) {
      ctx.fillStyle = opts.accent;
      ctx.fillText('.', PAD + ctx.measureText(line).width, titleTop + i * lineHeight);
      ctx.fillStyle = fg;
    }
  });

  if (opts.siteName.trim()) {
    const footY = H - PAD - 10;
    ctx.fillStyle = opts.accent;
    ctx.beginPath();
    ctx.arc(PAD + 6, footY + 13, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = muted;
    ctx.font = '500 24px Geist, Inter, system-ui, sans-serif';
    ctx.fillText(opts.siteName, PAD + 24, footY);
  }
}
