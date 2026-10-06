// The sentence under "Cost to you", true of the line it is on (sparx persona
// issue 086).
//
// It said "From the product" on every line with a product, and most products
// have no cost on file (all 777 of Gillett Diesel's), so the box sat empty under
// a sentence saying it had been filled. It now says which: the product has no
// cost, the cost came from the product (only while it still does), or neither.

export interface CostHelpInput {
  markupMode: boolean;
  productId: string | null;
  /** The box, as held: '' for empty. */
  cost: string;
  /** What picking the product put in the box in this sitting: its cost, '' when
   *  it had none, or null when no product was picked since the editor opened. */
  productCost: string | null;
}

function sameAmount(a: string, b: string): boolean {
  return a.trim() !== '' && b.trim() !== '' && Number(a) === Number(b);
}

export function costHelp(input: CostHelpInput): string {
  if (input.markupMode) return 'What it cost you. The price is worked out from this.';
  if (!input.productId) return 'Optional. Only you see it. Your margin is worked out from it.';
  // Empty on a line with a product means the product has none: picked just now
  // it brought none, and saved, the server fills the product's cost when it has one.
  if (input.cost.trim() === '') {
    return 'This product has no cost on file. Type what it cost you to see your margin.';
  }
  if (input.productCost !== null && sameAmount(input.cost, input.productCost)) {
    return 'From the product. Change it if this one cost you more or less. Only you see it.';
  }
  return 'Only you see it. Your margin is worked out from it.';
}
