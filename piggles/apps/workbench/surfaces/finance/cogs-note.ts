// One sentence under the cost-of-goods line on the profit screen. A $0.00 over
// shelves with no costs is a gap, not a figure (issue 545); a figure that counts
// only the costed things says what it leaves out (sparx issue 271).

export function costOfGoodsNote(
  cogsCents: number,
  uncostedItems: number,
  uncostedUnits: number
): { detail: string; unmeasured: boolean; partial: boolean; gap: string | null } {
  const measured = 'What the stock you sold actually cost you, from your inventory records.';
  if (uncostedItems <= 0) return { detail: measured, unmeasured: false, partial: false, gap: null };
  const things =
    uncostedItems === 1 ? '1 thing' : `${uncostedItems.toLocaleString('en-US')} things`;
  const units = uncostedUnits === 1 ? '1 unit' : `${uncostedUnits.toLocaleString('en-US')} units`;
  const gap = `${things} on your shelves, ${units} in all, have never had a cost recorded.`;
  if (cogsCents > 0) {
    // Measured as far as it goes, so the figure stays; what it leaves out is said (issue 271).
    return {
      unmeasured: false,
      partial: true,
      gap,
      detail: `${measured} Only things with a cost count: ${things} on your shelves, ${units} in all, have never had one, so any of them sold here count as free.`,
    };
  }
  return {
    unmeasured: true,
    partial: false,
    gap,
    detail: `Nothing here has been measured yet: ${things} on your shelves, ${units} in all, have never had a cost recorded. Until they do, what you make on each sale cannot be worked out.`,
  };
}
