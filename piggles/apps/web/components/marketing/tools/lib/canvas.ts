/**
 * Loading a picture somebody dropped in, and getting pixels back out.
 *
 * Everything here is browser-only. It is kept apart from the tools that use it
 * because the same three operations — decode a file, draw it at a size, hand
 * back a PNG — are what the favicon maker, the share-image maker and the QR logo
 * all need, and because image decoding has more edge cases than it looks.
 */

export class ImageError extends Error { }

export interface LoadedImage {
    /** Drawable at any size. */
    source: CanvasImageSource;
    width: number;
    height: number;
    /** Set for SVG input. An SVG has no natural resolution, so it can be drawn
     *  crisply at any size — which is worth knowing, because a raster original
     *  scaled up to 512px is the main reason a favicon comes out soft. */
    isVector: boolean;
    /** Whether any pixel is less than fully opaque. Decides whether the Apple
     *  touch icon needs a background filled in behind it. */
    hasTransparency: boolean;
}

const MAX_BYTES = 12 * 1024 * 1024;

/**
 * Decode a dropped file.
 *
 * SVG is handled through a blob URL into an `<img>` rather than through
 * `createImageBitmap`, which refuses SVG in several browsers. The width and
 * height then come from the element, and an SVG with no intrinsic size reports
 * zero — so a fallback square is applied rather than dividing by it later.
 */
export async function loadImageFile(file: File): Promise<LoadedImage> {
    if (file.size > MAX_BYTES) {
        throw new ImageError(
            `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB, which is larger than this can handle. A logo is usually well under 1MB — if yours is a photograph, it is probably the wrong picture for this.`
        );
    }

    const isVector = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
    if (!isVector && !/^image\/(png|jpeg|webp|gif|bmp|avif)$/.test(file.type)) {
        throw new ImageError(
            'That does not look like an image. PNG, JPG, SVG and WebP all work — a PNG with a transparent background works best.'
        );
    }

    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const element = new Image();
            element.onload = () => resolve(element);
            element.onerror = () =>
                reject(
                    new ImageError(
                        'That image could not be opened. If it came from a design tool, exporting it again as a PNG usually sorts it out.'
                    )
                );
            element.src = url;
        });

        const width = img.naturalWidth || (isVector ? 512 : 0);
        const height = img.naturalHeight || (isVector ? 512 : 0);
        if (width === 0 || height === 0) {
            throw new ImageError('That image has no size to it — it may be empty or damaged.');
        }

        return {
            source: img,
            width,
            height,
            isVector,
            // An SVG is assumed transparent: reading its pixels would need it drawn
            // first, and assuming transparency only means the Apple icon gets a
            // background it might not have needed, which is harmless.
            hasTransparency: isVector || detectTransparency(img, width, height),
        };
    } finally {
        // Deliberately NOT revoked — the <img> keeps referencing it for as long as
        // it is drawable, and revoking here makes every later draw produce a blank
        // canvas. The URL is released when the page goes.
    }
}

function detectTransparency(img: HTMLImageElement, width: number, height: number): boolean {
    // Sampled at a small size rather than full resolution: a 4000px logo would
    // otherwise mean reading 16 million pixels to answer a yes/no question, which
    // locks the tab for a noticeable moment.
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;

    const scale = Math.min(size / width, size / height);
    ctx.drawImage(img, 0, 0, width * scale, height * scale);
    try {
        const { data } = ctx.getImageData(0, 0, size, size);
        for (let i = 3; i < data.length; i += 4) if (data[i]! < 250) return true;
        return false;
    } catch {
        // A cross-origin image taints the canvas. Cannot happen for a local file,
        // but assuming transparency is the safe answer if it ever does.
        return true;
    }
}

export interface DrawOptions {
    size: number;
    /** Filled behind the image. Omit to keep transparency. */
    background?: string;
    /** Proportion of the canvas left empty around the image, 0 to 0.4. Android's
     *  maskable icons crop to a circle and need this; a normal favicon does not. */
    padding?: number;
    /** `contain` keeps the whole logo visible; `cover` fills the square and crops.
     *  A favicon wants contain — a cropped logo is not a smaller logo. */
    fit?: 'contain' | 'cover';
}

/** Draw to a square canvas at the given size. */
export function drawSquare(image: LoadedImage, opts: DrawOptions): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = opts.size;
    canvas.height = opts.size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageError('This browser would not give us a canvas to draw on.');

    if (opts.background) {
        ctx.fillStyle = opts.background;
        ctx.fillRect(0, 0, opts.size, opts.size);
    }

    // Smoothing at the highest setting. The difference between this and the
    // default is plainly visible at 16 pixels, which is the size that matters most.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const inset = opts.size * (opts.padding ?? 0);
    const box = opts.size - inset * 2;
    const scale =
        opts.fit === 'cover'
            ? Math.max(box / image.width, box / image.height)
            : Math.min(box / image.width, box / image.height);

    const w = image.width * scale;
    const h = image.height * scale;
    ctx.drawImage(image.source, (opts.size - w) / 2, (opts.size - h) / 2, w, h);

    return canvas;
}

export function canvasToBlob(
    canvas: HTMLCanvasElement,
    type = 'image/png',
    quality?: number
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new ImageError('The image could not be encoded.'))),
            type,
            quality
        );
    });
}

/** Raw RGBA, for the ICO writer — which needs pixels rather than a PNG for the
 *  smallest sizes. */
export function canvasToRgba(canvas: HTMLCanvasElement): Uint8ClampedArray {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new ImageError('This browser would not give us a canvas to read.');
    return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
}

/** The average color of the image, used to suggest a background for the Apple
 *  touch icon. Transparent pixels are skipped — including them drags every
 *  suggestion towards black, which is exactly the wrong answer for a logo on a
 *  transparent background. */
export function averageColor(canvas: HTMLCanvasElement): string {
    const data = canvasToRgba(canvas);
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3]! < 128) continue;
        r += data[i]!;
        g += data[i + 1]!;
        b += data[i + 2]!;
        n++;
    }
    if (n === 0) return '#FFFFFF';
    const hex = (v: number) =>
        Math.round(v / n)
            .toString(16)
            .padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
}
