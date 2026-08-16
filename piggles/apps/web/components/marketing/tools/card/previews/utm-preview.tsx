/** A tagged link, with the part the tool adds picked out. */
export function UtmPreview() {
  return (
    <div className="rounded-field w-full bg-white p-3 text-left">
      <p className="font-mono text-[11px] leading-relaxed break-all text-[#202631]">
        bellacafe.example/menu
        <span className="text-[#B42318]">?utm_source=instagram</span>
        <span className="text-[#14804A]">&amp;utm_medium=social</span>
        <span className="text-[#2563EB]">&amp;utm_campaign=spring-menu</span>
      </p>
    </div>
  );
}
