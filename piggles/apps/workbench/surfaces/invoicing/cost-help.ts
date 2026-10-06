// The words under "Cost to you", true of the line they are on (sparx persona
// issue 086). "From the product" sat over an empty box on every part with no
// cost on file, which is all 777 of Gillett Diesel's.

export interface CostHelpInput {
  markupMode: boolean;
  productId: string | null;
  /** The box, as held: '' for empty. */
  cost: string;
  /** What picking a product put in the box this sitting ('' for none), or null. */
  productCost: string | null;
}

function sameAmount(a: string, b: string): boolean {
  return a.trim() !== '' && b.trim() !== '' && Number(a) === Number(b);
}

export function costHelp(input: CostHelpInput): string {
  if (input.markupMode) return 'What it cost you. The price is worked out from this.';
  if (!input.productId) return 'Optional. Only you see it. Your margin is worked out from it.';
  // Empty with a product means it has none: saved, the server fills it when it does.
  if (input.cost.trim() === '') {
    return 'This product has no cost on file. Type what it cost you to see your margin.';
  }
  if (input.productCost !== null && sameAmount(input.cost, input.productCost)) {
    return 'From the product. Change it if this one cost you more or less. Only you see it.';
  }
  return 'Only you see it. Your margin is worked out from it.';
}
