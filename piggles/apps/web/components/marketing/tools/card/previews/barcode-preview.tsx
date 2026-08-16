import { barcodeSvg, encodeEan } from '../../lib/barcode';

/** A real EAN-13, check digit and all — 5901234123457 is the standard example. */
const svg = barcodeSvg(encodeEan('590123412345', 'ean13'), {
  moduleWidth: 2,
  height: 56,
  showText: true,
  quietZone: 6,
});

export function BarcodePreview() {
  return (
    <div
      className="rounded-field mx-auto w-full max-w-[15rem] overflow-hidden bg-white p-2 [&>svg]:h-auto [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
