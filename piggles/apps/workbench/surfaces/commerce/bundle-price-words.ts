// What the bundle form says about money.
//
// The form asks a shop owner to price a set, and until now it did that with no
// number on the screen at all. The parts each have a price — the picker she
// chose them from prints it — and the moment one was added the price was
// dropped on the floor. So she chose between "add up the parts", "a flat price
// I set" and "a percentage off the parts' total" while the parts' total was the
// one thing nobody would tell her.
//
// The arithmetic is NOT here. It lives in `@wizeworks/commerce-schemas`, in the
// same two functions the pricing pipeline uses to charge the shopper, because a
// second copy would be a second answer to "what does this set cost" and the one
// she reads while setting it up is the one she would never think to doubt. This
// file only turns that answer into sentences.

/** Renders cents the way the pane does. Passed in so this module stays pure. */
export type Money = (cents: number) => string;

export interface PartsNote {
  text: string;
  /** No parts yet is not a number, it is an instruction. */
  isPrompt: boolean;
}

/**
 * The line under the list of parts.
 *
 * Counted in words on both branches, because "1 part(s)" is a programmer
 * counting and this sentence is read by somebody pricing a gift set.
 */
export function partsNote(partCount: number, partsCents: number, money: Money): PartsNote {
  if (partCount <= 0) {
    return {
      text: 'Add the products that go in the set, and this will say what they come to.',
      isPrompt: true,
    };
  }
  if (partCount === 1) {
    return { text: `One part, ${money(partsCents)}.`, isPrompt: false };
  }
  return { text: `${String(partCount)} parts add up to ${money(partsCents)}.`, isPrompt: false };
}

export interface SetPriceNote {
  text: string;
  /**
   * `warning` for the one answer that is almost always a slip: a set that costs
   * MORE than buying its parts one at a time. It is a legal thing to do and the
   * server accepts it, so this warns rather than blocks — but nothing else on
   * this form would have told her, and a shopper adding up the product pages
   * will work it out in about four seconds.
   */
  tone: 'warning' | null;
}

/**
 * What the shopper pays, said next to the control that decides it.
 *
 * Every one of the three modes had a sentence already, and all three referred
 * to a total they refused to print. The flat-price one went furthest:
 * "Shoppers pay exactly this, whatever the parts add up to" names the number
 * and then withholds it.
 */
export function setPriceNote(input: {
  pricingMode: string;
  partCount: number;
  partsCents: number;
  setCents: number;
  money: Money;
}): SetPriceNote {
  const { partCount, partsCents, setCents, money } = input;
  if (partCount <= 0) {
    return { text: 'Add some parts and this will say what a shopper pays.', tone: null };
  }

  const pays = money(setCents);
  if (setCents > partsCents) {
    return {
      text:
        `Shoppers pay ${pays}, which is ${money(setCents - partsCents)} MORE than buying ` +
        'the parts on their own. Check that is what you meant.',
      tone: 'warning',
    };
  }
  if (setCents === partsCents) {
    // True of `sum_of_components` always, and of the other two whenever the
    // number typed happens to land on the total. Same sentence either way:
    // what she needs to know is that the set saves nobody anything.
    return {
      text: `Shoppers pay ${pays}, the same as buying the parts on their own.`,
      tone: null,
    };
  }
  return {
    text: `Shoppers pay ${pays}, saving ${money(partsCents - setCents)} against the parts on their own.`,
    tone: null,
  };
}

/**
 * What one part contributes, on its own row.
 *
 * Only spells the multiplication when there is one, so a set of single items
 * reads as a list of prices rather than a column of "1 × ".
 */
export function partLineNote(priceCents: number, quantity: number, money: Money): string {
  if (quantity <= 1) return money(priceCents);
  return `${String(quantity)} × ${money(priceCents)} = ${money(priceCents * quantity)}`;
}
