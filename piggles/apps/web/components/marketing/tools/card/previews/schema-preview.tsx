/** What the markup earns: the extra lines under a result. */
export function SchemaPreview() {
  return (
    <div className="rounded-field w-full bg-white p-3 text-left">
      <p className="text-sm leading-snug text-[#1a0dab]">Bella Cafe</p>
      <p className="mt-1 text-[11px] text-[#4d5156]">
        <span className="text-[#E8A200]">★★★★★</span> 4.8 · Cafe · $$
      </p>
      <p className="mt-0.5 text-[11px] text-[#4d5156]">
        <span className="font-semibold text-[#14804A]">Open</span> · Closes 5 pm · Ancoats
      </p>
    </div>
  );
}
