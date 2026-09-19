// Finding a person by the name they are actually called.
//
// ---------------------------------------------------------------------------
// The bug this exists for
// ---------------------------------------------------------------------------
//
// Every search box over people was written the same way: take the whole typed
// string and ask whether it is a SUBSTRING of one column.
//
//     OR: [
//       { firstName: { contains: q, mode: 'insensitive' } },
//       { lastName:  { contains: q, mode: 'insensitive' } },
//       { email:     { contains: q, mode: 'insensitive' } },
//     ]
//
// A person's name is stored in two columns and typed as one string, so "Jo Kim"
// is a substring of neither "Jo" nor "Kim" and the search returns nothing. The
// box that says "Order number or customer…" cannot find a customer by their
// name. Measured 2026-09-16: 635 of the platform's 651 customers have both a
// first and a last name, so that is nearly every person in the address book,
// across EIGHT search boxes (customers, orders, invoices, staff, B2B approvals,
// the scheduling waitlist, finance payments, customer lists).
//
// The damage is not the empty list. It is what the empty list then advises. The
// invoice customer picker answers "No customer matches that. Add them in
// Customers first." to somebody looking straight at a customer who exists — so
// the remedy on offer is to create a SECOND copy of them. One shop reached this
// state for real: an invoice for $276 whose printed name is one customer and
// whose email address is another.
//
// ---------------------------------------------------------------------------
// The rule
// ---------------------------------------------------------------------------
//
// Split what was typed on whitespace and require EVERY word to match somewhere.
// "Jo Kim" is then (something contains "Jo") AND (something contains "Kim"),
// which the two name columns satisfy between them.
//
// AND rather than OR is the deliberate half. Matching any word would make "Jo
// Kim" return every Jo and every Kim on the books, which is a longer list than
// the one that is already wrong. Requiring all of them narrows as the person
// types, which is what a search box is expected to do.
//
// A single word behaves EXACTLY as it did before — one clause, same columns —
// so this is never narrower than what it replaces.

/** How many words are worth asking about. A pasted paragraph is not a name, and
 *  each word past this adds a scan without adding an answer. */
const MAX_TERMS = 6;

/**
 * The words in a search box, in order, with the empties dropped.
 *
 * Exported for its own sake: the callers that build a clause need the words,
 * and so does anything that wants to say how many there were.
 */
export function searchTerms(q: string | null | undefined): string[] {
  if (!q) return [];
  return q.trim().split(/\s+/).slice(0, MAX_TERMS).filter(Boolean);
}

/**
 * Prisma `AND` entries for a multi-word search over people.
 *
 * `clausesFor` is given ONE word and returns the columns that word may match —
 * which fields those are differs per table (some search a relation, some a
 * company name), so it stays with the caller. This owns only the part that was
 * wrong everywhere: that all the words have to be accounted for.
 *
 * Returns entries to SPREAD into an existing `AND` array rather than an object
 * to merge into the `where`. A `where` may already carry an `AND` of its own
 * (the customer list's site-visibility scope is one), and a second `AND` key
 * would replace it in silence — dropping a filter that decides which rows a
 * site is allowed to see. An array composes; a key collides.
 *
 *     const where: Prisma.CustomerWhereInput = {
 *       deletedAt: null,
 *       AND: [
 *         ...siteScope,
 *         ...nameSearchClauses(filter.q, (term) => [
 *           { email: { contains: term, mode: 'insensitive' } },
 *           { firstName: { contains: term, mode: 'insensitive' } },
 *         ]),
 *       ],
 *     };
 *
 * An empty or missing query returns `[]`, so spreading it adds nothing.
 */
export function nameSearchClauses<Clause>(
  q: string | null | undefined,
  clausesFor: (term: string) => Clause[]
): { OR: Clause[] }[] {
  return searchTerms(q).map((term) => ({ OR: clausesFor(term) }));
}
