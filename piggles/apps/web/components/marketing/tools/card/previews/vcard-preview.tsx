import { qrSvg } from '../../lib/qr-svg';

/** A real vCard encode beside the details it carries. */
const svg = qrSvg('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Ada Keller\r\nTEL:+15551234567\r\nEND:VCARD', {
  ec: 'Q',
});

export function VcardPreview() {
  return (
    <div className="rounded-field flex w-full items-center gap-3 bg-white p-3">
      <div className="w-16 shrink-0" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="min-w-0 text-[#202631]">
        <p className="truncate text-sm font-bold">Ada Keller</p>
        <p className="truncate text-[11px]">Owner · Bella Cafe</p>
        <p className="mt-1 truncate font-mono text-[11px]">(555) 123-4567</p>
      </div>
    </div>
  );
}
