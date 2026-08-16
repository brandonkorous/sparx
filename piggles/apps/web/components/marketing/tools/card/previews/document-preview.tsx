/** The artefact both money tools produce: a small, totalled document. */
export function DocumentPreview({ kind }: { kind: 'invoice' | 'quote' }) {
  const words = kind === 'invoice' ? ['INVOICE', 'Amount due'] : ['QUOTE', 'Estimated total'];
  return (
    <div className="rounded-field w-full bg-white p-3 text-[#202631]">
      <div className="flex items-start justify-between">
        <span className="text-xs font-bold">Bella Cafe</span>
        <span className="text-xs font-extrabold tracking-wide">{words[0]}</span>
      </div>
      <div className="mt-3 space-y-1.5">
        {['Sourdough, 12 loaves', 'Delivery'].map((line) => (
          <div key={line} className="flex justify-between border-b border-[#eae7e8] pb-1">
            <span className="text-[11px]">{line}</span>
            <span className="font-mono text-[11px]">—</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between">
        <span className="text-[11px] font-bold">{words[1]}</span>
        <span className="font-mono text-sm font-extrabold">$248.00</span>
      </div>
    </div>
  );
}
