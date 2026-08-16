/** The verdict the tool gives: one pair that reads, one that does not. */
export function ContrastPreview() {
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="rounded-field flex items-center justify-between bg-white px-3 py-2.5">
        <span className="text-lg font-bold text-[#9CA3AF]">Pale grey</span>
        <span className="text-xs font-bold text-[#B42318]">2.5 · fails</span>
      </div>
      <div className="rounded-field flex items-center justify-between bg-white px-3 py-2.5">
        <span className="text-lg font-bold text-[#202631]">Deep charcoal</span>
        <span className="text-xs font-bold text-[#14804A]">14.8 · passes</span>
      </div>
    </div>
  );
}
