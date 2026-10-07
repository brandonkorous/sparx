// Which first-day jobs a business is asked to do, from what it said it does.
//
// The checklist was three jobs for everybody: add the first thing you sell, add
// someone you work with, send your first invoice. A journal that ticked "I need
// a website" and "I deal with customers", and nothing about selling, opened Home
// on "Add the first thing you sell" and "Send your first invoice" (Piggles
// persona issue 941). Its first job is to publish something, which the list did
// not have.
//
// Each job belongs to one of the signup answers. A business that never answered
// (made before the question, or answered nothing) keeps the original three.

export type FirstRunKey = 'article' | 'product' | 'customer' | 'invoice';

/** The signup answer each job belongs to: "I need a website", "I sell things",
 *  "I deal with customers", "I invoice people". */
const ANSWER: Record<FirstRunKey, string> = {
  article: 'web',
  product: 'sell',
  customer: 'people',
  invoice: 'money',
};

/** The jobs for nobody's answer in particular. */
const UNANSWERED: readonly FirstRunKey[] = ['product', 'customer', 'invoice'];

/** In the order a working day runs: something to offer, someone to offer it to,
 *  and getting paid. Publishing comes first because for a publisher it IS the
 *  thing on offer. */
const ORDER: readonly FirstRunKey[] = ['article', 'product', 'customer', 'invoice'];

export function stepsForAnswer(does: readonly string[] | null | undefined): FirstRunKey[] {
  if (!does || does.length === 0) return [...UNANSWERED];
  const picked = ORDER.filter((key) => does.includes(ANSWER[key]));
  return picked.length > 0 ? picked : [...UNANSWERED];
}
