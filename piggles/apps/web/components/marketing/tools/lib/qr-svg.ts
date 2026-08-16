import { encodeQr, type EcLevel } from './qr';

/** A QR matrix as SVG. Adjacent dark modules in a row merge into one rect, which
 *  keeps the file small enough to inline on a page of them. */
export function qrSvg(
  text: string,
  opts: { dark?: string; light?: string; quiet?: number; ec?: EcLevel } = {}
): string {
  const { dark = '#202631', light = '#FFFFFF', quiet = 2, ec = 'M' } = opts;
  const { matrix, size } = encodeQr(text, ec);
  const total = size + quiet * 2;
  const rects: string[] = [];

  for (let row = 0; row < size; row++) {
    let run = 0;
    for (let col = 0; col <= size; col++) {
      if (col < size && matrix[row]![col]) {
        run++;
        continue;
      }
      if (run > 0) {
        rects.push(`<rect x="${col - run + quiet}" y="${row + quiet}" width="${run}" height="1"/>`);
        run = 0;
      }
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}"`,
    ` shape-rendering="crispEdges" role="img" aria-label="An example QR code">`,
    `<rect width="${total}" height="${total}" fill="${light}"/>`,
    `<g fill="${dark}">${rects.join('')}</g></svg>`,
  ].join('');
}
