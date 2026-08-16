/** The document, as a document. */
export function LegalPreview() {
  return (
    <div className="rounded-field w-full bg-white p-3 text-left text-[#202631]">
      <p className="text-sm font-extrabold">Privacy policy</p>
      <p className="mt-0.5 text-[10px]">Bella Cafe · Effective 16 August 2026</p>
      <p className="mt-2 text-[11px] font-bold">What we collect</p>
      <p className="text-[10px] leading-relaxed">
        Your name, email address and whatever you write to us. We do not collect anything we do not
        need.
      </p>
      <p className="mt-1.5 text-[11px] font-bold">How long we keep it</p>
      <p className="text-[10px] leading-relaxed">About two years, unless the law says longer.</p>
    </div>
  );
}
