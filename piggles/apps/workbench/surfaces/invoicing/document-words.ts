// What the document on this screen is CALLED, in this console's words.
//
// One editor serves every document the billing engine knows about. That is the
// right architecture and the wrong default for words: press "Price up a quote"
// on the Quotes screen and the editor that opened said invoice on the tab, said
// "this invoice" under the customer box, and asked "When it should be paid" —
// about a price she had not sent yet, for money nobody owes. Underneath it IS
// a billing document; on screen it is a quote, and the screen is what she reads.
//
// The RULE (which workflows hold an offer rather than a bill, and what each is
// called) lives once, in @wizeworks/crm-schemas, because the renderer that
// prints the page a customer receives has to agree with this screen. This file
// only adds the console's own phrasing on top.

import { billingDocumentNoun, isPriceOfferWorkflow } from '@wizeworks/crm-schemas/builtins';

/**
 * Is this document an offer of a price, rather than a demand for money?
 *
 * The difference is not cosmetic. An offer runs out (`validUntil`); a bill falls
 * due and then counts days late (`dueAt`). They are two columns, and writing the
 * wrong one is how a quote ends up with no expiry and an invoice with no
 * deadline.
 */
export function isPriceOffer(workflowSlug: string | null | undefined): boolean {
  return isPriceOfferWorkflow(workflowSlug);
}

/** What to call this document in a sentence: "quote", "estimate", "invoice". */
export function documentNoun(workflowSlug: string | null | undefined): string {
  return billingDocumentNoun(workflowSlug);
}

/** The tab name for a brand-new document of this kind. */
export function newDocumentTitle(workflowSlug: string | null | undefined): string {
  return `New ${documentNoun(workflowSlug)}`;
}

/** The same noun with a capital, for a heading or the top of a printed page. */
export function documentTitleCase(workflowSlug: string | null | undefined): string {
  const noun = documentNoun(workflowSlug);
  return noun.charAt(0).toUpperCase() + noun.slice(1);
}
