/** What the tool makes AND where it lands: a 1200 × 630 card in its true
 *  proportions, sitting in a link unfurl the way a messaging app shows it. */
export function OgPreview() {
  return (
    <div className="rounded-field w-full overflow-hidden bg-white">
      <div className="relative flex aspect-[1200/630] flex-col justify-center bg-[#FBF7F8] px-4">
        <span className="absolute inset-y-0 left-0 w-2 bg-[#FF6F86]" />
        <p className="text-base leading-[1.05] font-extrabold text-[#202631]">
          Wood-fired pizza
          <br />
          in Ancoats
        </p>
        <p className="mt-1.5 text-[10px] leading-tight text-[#4B5563]">
          Open Thursday to Sunday, three minutes from the tram
        </p>
        <p className="absolute bottom-3 left-4 text-[10px] font-bold text-[#FF6F86]">Bella Cafe</p>
      </div>

      <div className="border-t border-[#eae7e8] px-3 py-2">
        <p className="text-[10px] text-[#4B5563]">bellacafe.example</p>
        <p className="text-[11px] font-bold text-[#202631]">Wood-fired pizza in Ancoats</p>
      </div>
    </div>
  );
}
