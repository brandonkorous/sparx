/**
 * Canvas helpers for the image tools (favicon, OG card, QR logo overlay).
 *
 * All rasterisation happens on a client `<canvas>` — the source image never
 * leaves the browser. SVG sources are supported because an `<img>` can decode
 * SVG and be drawn to a canvas; the result is a same-origin (untainted) canvas
 * we can read back as PNG bytes.
 */

/** Decode a File (PNG/JPG/SVG/WebP) into an HTMLImageElement. */
export function loadImageFromFile(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return loadImageFromUrl(url).finally(() => URL.revokeObjectURL(url));
}

/** Decode an image URL (object URL or data URL) into an HTMLImageElement. */
export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image'));
    img.src = url;
  });
}

export interface IconRenderOptions {
  /** Output edge length in px (square). */
  size: number;
  /** Solid background fill, or null/undefined for transparent. */
  background?: string | null;
  /** Inset around the artwork as a fraction of `size` (0–0.45). */
  padding?: number;
  /** Corner radius as a fraction of `size` (0 = square, 0.5 = circle). */
  radius?: number;
}

/**
 * Render a source image into a square icon canvas: optional rounded background,
 * the artwork scaled to "contain" (aspect preserved) inside the padded area.
 */
export function renderIconCanvas(
  img: HTMLImageElement,
  { size, background, padding = 0, radius = 0 }: IconRenderOptions
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const r = Math.min(0.5, Math.max(0, radius)) * size;
  if (r > 0 || background) {
    roundedRectPath(ctx, 0, 0, size, size, r);
    if (background) {
      ctx.fillStyle = background;
      ctx.fill();
    }
    ctx.clip();
  }

  const inset = Math.min(0.45, Math.max(0, padding)) * size;
  const box = size - inset * 2;
  const scale = Math.min(box / img.width, box / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  return canvas;
}

/** Trace a rounded-rectangle path (does not fill/stroke). */
export function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Read a canvas back as PNG bytes (for .ico embedding and zip bundling). */
export function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas export failed'));
        return;
      }
      blob.arrayBuffer().then((ab) => resolve(new Uint8Array(ab)), reject);
    }, 'image/png');
  });
}

/** Read a canvas back as a PNG Blob. */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))),
      'image/png'
    );
  });
}
