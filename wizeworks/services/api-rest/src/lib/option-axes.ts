// Merging every product's declared option order into ONE order for the shop.
//
// A shop's "Size" axis is not declared once. Each product declares its own options
// and its own values, each in an order the owner set by typing or dragging them. The
// storefront's facet panel shows ONE Size group across the whole catalog, so those
// per-product orders have to be merged.
//
// ── WHY THIS IS A TOPOLOGICAL MERGE AND NOT A SORT ──────────────────────────
//
// The tempting rules are to score each value — its lowest declared position, or its
// mean — and sort by the score. Both are wrong, and they are wrong on a shape any
// real shop has: one product that only comes in the big sizes.
//
//   Sunday Trouser   L(0)  XL(1)
//   Marlow Knit      XS(0) S(1) M(2) L(3) XL(4)
//
//   lowest position → L, XS, XL, S, M
//   mean position   → XS, S, L, M, XL
//   what she typed  → XS, S, M, L, XL
//
// A position is only meaningful WITHIN the product that declared it: the trouser's
// `L(0)` says "L is this item's smallest", never "L is the shop's smallest". Any rule
// that compares positions across products is comparing two different scales.
//
// What each product actually states is a partial order — XS before S, S before M —
// and those compose. Merging them is a topological sort over the union of the
// precedences, which is the same problem as merging two histories, and it gets the
// case above right: `L before XL` from the trouser adds nothing the knit had not
// already said, so the knit's ladder survives whole.
//
// ── WHAT HAPPENS WHEN TWO PRODUCTS CONTRADICT EACH OTHER ────────────────────
//
// One says S before M and another says M before S. There is no correct answer, so
// the cycle is broken by first appearance and everything is still emitted — an
// unresolvable order must never mean a MISSING filter row. It degrades to a stable,
// arbitrary order for the values caught in the cycle, which is exactly what the whole
// panel did before this existed.
//
// Values are compared EXACTLY, never case-folded. `XS` and `xs` are two different
// tokens in the search index, so the facet panel renders two rows for them; folding
// them here would produce an order naming a row the panel does not have.

/** One product's declaration of one axis, as the route selects it. */
export interface DeclaredOption {
  /** Which product declared it — the grouping the AXIS order is merged over, since
   *  "Size before Color" is a statement one product makes about its own two axes. */
  productId: string;
  name: string;
  position: number;
  values: { value: string; position: number }[];
}

/** The shop-wide order for one axis. `values` is the merged ladder, in order. */
export interface OptionAxis {
  name: string;
  values: string[];
}

/**
 * Merge a set of declared sequences into one.
 *
 * Kahn's algorithm over consecutive-pair edges. Ready nodes are taken in first-seen
 * order, so the result is deterministic — the route states no `orderBy`, and a ladder
 * that changed between two identical requests would make the panel flicker.
 */
function mergeSequences(sequences: string[][]): string[] {
  const seen: string[] = [];
  const after = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();

  const note = (name: string): void => {
    if (indegree.has(name)) return;
    seen.push(name);
    indegree.set(name, 0);
    after.set(name, new Set());
  };

  for (const sequence of sequences) {
    for (const name of sequence) note(name);
    for (let i = 1; i < sequence.length; i++) {
      const from = sequence[i - 1]!;
      const to = sequence[i]!;
      // A pair two products both state is one edge, not two — otherwise the same
      // agreement counted twice would leave `to` permanently blocked.
      if (from === to || after.get(from)!.has(to)) continue;
      after.get(from)!.add(to);
      indegree.set(to, indegree.get(to)! + 1);
    }
  }

  const out: string[] = [];
  const emitted = new Set<string>();
  // Re-scanning `seen` each round keeps "take the earliest-seen ready node" true even
  // when a node becomes ready late. The lists here are option values on one shop's
  // catalog — tens, not thousands — so the simple form is the right one.
  let progress = true;
  while (progress) {
    progress = false;
    for (const name of seen) {
      if (emitted.has(name) || indegree.get(name) !== 0) continue;
      emitted.add(name);
      out.push(name);
      for (const next of after.get(name)!) indegree.set(next, indegree.get(next)! - 1);
      progress = true;
      break;
    }
  }

  // Whatever a cycle left behind, in first-seen order. Never dropped.
  for (const name of seen) if (!emitted.has(name)) out.push(name);
  return out;
}

/**
 * Every option axis in the catalog, each with its values in the order the shop
 * declared them.
 *
 * Axes are merged the same way as values, over each product's own axis sequence — a
 * shop that puts Size before Color gets Size first, rather than whichever axis the
 * query happened to return.
 *
 * A name or value that is blank after trimming is dropped: it matches no facet token
 * (the search projection trims the same way), so carrying it would put a row in the
 * order that the panel can never render.
 */
export function mergeOptionAxes(declared: DeclaredOption[]): OptionAxis[] {
  const perProductAxes = new Map<string, { name: string; position: number }[]>();
  const perAxisValues = new Map<string, string[][]>();

  for (const option of declared) {
    const name = option.name.trim();
    if (!name) continue;

    const axes = perProductAxes.get(option.productId) ?? [];
    axes.push({ name, position: option.position });
    perProductAxes.set(option.productId, axes);

    const values = [...option.values]
      .sort((a, b) => a.position - b.position)
      .map((v) => v.value.trim())
      .filter((v) => v.length > 0);
    if (values.length === 0) continue;
    const sequences = perAxisValues.get(name) ?? [];
    sequences.push(values);
    perAxisValues.set(name, sequences);
  }

  const axisSequences = [...perProductAxes.values()].map((axes) =>
    [...axes].sort((a, b) => a.position - b.position).map((a) => a.name)
  );

  return mergeSequences(axisSequences)
    .map((name) => ({ name, values: mergeSequences(perAxisValues.get(name) ?? []) }))
    .filter((axis) => axis.values.length > 0);
}
