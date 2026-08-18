/**
 * QR payload building + rendering. The `qrcode` dependency is dynamically
 * imported so it only loads on this tool's route, never in the marketing
 * bundle. PNG renders to a canvas (so we can overlay a center logo); SVG is
 * generated as scalable markup with the logo injected as an <image>.
 */
import { loadImageFromUrl, roundedRectPath } from './canvas';

export type QrType = 'url' | 'text' | 'email' | 'tel' | 'sms' | 'wifi' | 'vcard';

export type QrFields = Record<string, string>;

export interface QrStyle {
  fg: string;
  bg: string;
  ecc: 'L' | 'M' | 'Q' | 'H';
  margin: number;
  /** Pixel size for raster export. */
  width: number;
  /** Center logo data URL, or null. */
  logo: string | null;
}

/** Compose the encoded string for a given content type. */
export function buildQrPayload(type: QrType, f: QrFields): string {
  const esc = (s: string) => (s ?? '').replace(/([\\;,:"])/g, '\\$1');
  switch (type) {
    case 'url':
      return f.url ?? '';
    case 'text':
      return f.text ?? '';
    case 'tel':
      return f.tel ? `tel:${f.tel}` : '';
    case 'sms':
      return f.tel ? `SMSTO:${f.tel}:${f.message ?? ''}` : '';
    case 'email': {
      if (!f.email) return '';
      const params = new URLSearchParams();
      if (f.subject) params.set('subject', f.subject);
      if (f.body) params.set('body', f.body);
      const q = params.toString();
      return `mailto:${f.email}${q ? `?${q}` : ''}`;
    }
    case 'wifi': {
      if (!f.ssid) return '';
      const enc = f.encryption && f.encryption.length > 0 ? f.encryption : 'WPA';
      return `WIFI:T:${enc};S:${esc(f.ssid)};P:${esc(f.password ?? '')};H:${
        f.hidden === 'true' ? 'true' : 'false'
      };;`;
    }
    case 'vcard': {
      if (!f.firstName && !f.lastName && !f.org) return '';
      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `N:${f.lastName ?? ''};${f.firstName ?? ''}`,
        `FN:${`${f.firstName ?? ''} ${f.lastName ?? ''}`.trim()}`,
      ];
      if (f.org) lines.push(`ORG:${f.org}`);
      if (f.title) lines.push(`TITLE:${f.title}`);
      if (f.phone) lines.push(`TEL;TYPE=CELL:${f.phone}`);
      if (f.email) lines.push(`EMAIL:${f.email}`);
      if (f.url) lines.push(`URL:${f.url}`);
      lines.push('END:VCARD');
      return lines.join('\n');
    }
  }
}

/** Render the QR onto a canvas, overlaying a center logo when present. */
export async function renderQrCanvas(
  canvas: HTMLCanvasElement,
  data: string,
  style: QrStyle
): Promise<void> {
  const QRCode = (await import('qrcode')).default;
  await QRCode.toCanvas(canvas, data, {
    errorCorrectionLevel: style.ecc,
    margin: style.margin,
    width: style.width,
    color: { dark: style.fg, light: style.bg },
  });
  // qrcode.toCanvas hard-codes the canvas inline style to the bitmap pixel size
  // (e.g. 1024px), clobbering our CSS layout. Reset it to fill its sized wrapper
  // so the displayed code stays a responsive square instead of stretching.
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  if (!style.logo) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = await loadImageFromUrl(style.logo);
  const s = canvas.width;
  const box = s * 0.26;
  const bx = (s - box) / 2;
  ctx.fillStyle = style.bg;
  roundedRectPath(ctx, bx, bx, box, box, box * 0.16);
  ctx.fill();

  const max = s * 0.2;
  const scale = Math.min(max / img.width, max / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (s - w) / 2, (s - h) / 2, w, h);
}

/** Generate scalable SVG markup, injecting the logo as a centered <image>. */
export async function renderQrSvg(data: string, style: QrStyle): Promise<string> {
  const QRCode = (await import('qrcode')).default;
  let svg = await QRCode.toString(data, {
    type: 'svg',
    errorCorrectionLevel: style.ecc,
    margin: style.margin,
    color: { dark: style.fg, light: style.bg },
  });
  if (!style.logo) return svg;

  const match = /viewBox="0 0 (\d+(?:\.\d+)?) /.exec(svg);
  const dim = match ? parseFloat(match[1]!) : 100;
  const box = dim * 0.26;
  const logo = dim * 0.2;
  const overlay =
    `<rect x="${(dim - box) / 2}" y="${(dim - box) / 2}" width="${box}" height="${box}" rx="${box * 0.16}" fill="${style.bg}"/>` +
    `<image x="${(dim - logo) / 2}" y="${(dim - logo) / 2}" width="${logo}" height="${logo}" href="${style.logo}" preserveAspectRatio="xMidYMid meet"/>`;
  svg = svg.replace('</svg>', `${overlay}</svg>`);
  return svg;
}
