/**
 * Barcode rendering via jsbarcode (dynamically imported, so it never enters the
 * marketing bundle). Renders to a canvas for PNG export and to an SVG string for
 * scalable export. jsbarcode validates the symbology and computes check digits,
 * and throws on invalid input — callers catch and surface the message.
 */
export type BarcodeFormat = 'CODE128' | 'CODE39' | 'EAN13' | 'EAN8' | 'UPC';

export interface BarcodeStyle {
  format: BarcodeFormat;
  lineColor: string;
  background: string;
  height: number;
  displayValue: boolean;
}

const SHARED = (style: BarcodeStyle) => ({
  format: style.format,
  lineColor: style.lineColor,
  background: style.background,
  height: style.height,
  displayValue: style.displayValue,
  width: 2,
  margin: 10,
  fontSize: 16,
});

/** Render onto a canvas; throws if `value` is invalid for the format. */
export async function renderBarcodeCanvas(
  canvas: HTMLCanvasElement,
  value: string,
  style: BarcodeStyle
): Promise<void> {
  const JsBarcode = (await import('jsbarcode')).default;
  JsBarcode(canvas, value, SHARED(style));
}

/** Render to scalable SVG markup; throws if `value` is invalid for the format. */
export async function renderBarcodeSvg(value: string, style: BarcodeStyle): Promise<string> {
  const JsBarcode = (await import('jsbarcode')).default;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, value, SHARED(style));
  return new XMLSerializer().serializeToString(svg);
}

/** Human label + required length hint for each supported format. */
export const BARCODE_FORMATS: { value: BarcodeFormat; label: string; hint: string }[] = [
  { value: 'CODE128', label: 'Code 128', hint: 'Any text or number — SKUs, shipping, internal.' },
  { value: 'UPC', label: 'UPC-A', hint: '11 digits (12th is the check digit, added for you).' },
  { value: 'EAN13', label: 'EAN-13', hint: '12 digits (13th is the check digit, added for you).' },
  { value: 'EAN8', label: 'EAN-8', hint: '7 digits (8th is the check digit, added for you).' },
  { value: 'CODE39', label: 'Code 39', hint: 'Letters, digits, and a few symbols — asset tags.' },
];
