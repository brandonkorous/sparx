// What a transfer can take from where it leaves, in words.
//
// The warning read "-29 available at Warehouse (Concord Park)": the shelf held
// 11 and unshipped orders wanted 40, so available was below zero, and it was
// printed as a count. Nobody has minus 29 of anything. When nothing is free
// the title says so, and the reason says how far short the shelf is
// (sparx persona issue 316).

export interface SourceStock {
  onHand: number;
  allocated: number;
  available: number;
}

const count = (n: number): string => n.toLocaleString('en-US');

/** The alert's title: how many can move from `place`. */
export function availableTitle(level: SourceStock, place: string): string {
  return level.available > 0
    ? `${count(level.available)} available at ${place}`
    : `None free at ${place}`;
}

/** Why fewer can move than are on the shelf. Null when nothing is spoken for. */
export function spokenForReason(level: SourceStock): string | null {
  if (level.allocated <= 0) return null;
  const short = level.allocated - level.onHand;
  const owed =
    short > 0
      ? `${count(level.onHand)} are on the shelf, and orders not yet shipped and baskets still open hold ${count(level.allocated)}: ${count(short)} more than you have.`
      : `${count(level.onHand)} are on the shelf, but ${count(level.allocated)} are held for orders not yet shipped and baskets still open.`;
  return `${owed} A transfer can only take what is free.`;
}
