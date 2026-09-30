// What to store for the buyer's note, given what the client sent.
//
// Three states, not two, and collapsing them is how a shopper loses their own
// words (issue 874):
//
//   ABSENT   the caller is not talking about notes. An older storefront, the B2B
//            portal, an integration. Leave whatever is stored alone.
//   EMPTY    somebody selected the text in the box and deleted it. That is an
//            answer, and it has to clear the note. A falsy test ("if (!sent)")
//            reads this as ABSENT, which makes the box impossible to empty: the
//            note comes back on the next render and the shopper cannot tell why.
//   TEXT     store it, trimmed. A box holding only spaces is an empty box, and
//            storing those spaces prints a blank line on the order under a
//            heading that says the customer said something.
//
// Returned as an object to spread into a Prisma `data`, so ABSENT is genuinely
// an absent key rather than an explicit undefined.
export function noteWrite(sent: string | undefined): { customerNote?: string | null } {
  if (sent === undefined) return {};
  return { customerNote: sent.trim() || null };
}
