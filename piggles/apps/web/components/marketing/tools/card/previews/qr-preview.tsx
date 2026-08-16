import { qrSvg } from '../../lib/qr-svg';

/** A genuine encode of the tool's own page — scan it and you land here. */
const svg = qrSvg('https://meetpiggles.com/tools/qr-code', { ec: 'Q' });

export function QrPreview() {
  return (
    <div
      className="rounded-field mx-auto w-32 overflow-hidden bg-white p-2"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
