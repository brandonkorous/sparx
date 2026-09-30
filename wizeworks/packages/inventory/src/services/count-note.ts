// What to store as a count line's note, given what the caller sent.
//
// The same three states as the buyer's note at checkout, and the same reason
// for spelling them out rather than writing the expression inline: collapsing
// two of them is invisible, compiles, and makes a box impossible to empty.
// (`checkout-note.ts` in @wizeworks/commerce is the twin; issue 874 is the one
// that found the shape, issue 876 is this one.)
//
//   ABSENT   the caller is saving a quantity and is not talking about the note
//            at all. A bulk import, the scan-to-count flow, an older console.
//            Leave whatever is stored alone.
//   EMPTY    somebody selected the words and deleted them. That is an answer,
//            and it has to clear the note. Stored as NULL rather than as an
//            empty string, so that counting the filled notes on this table
//            keeps meaning what it says.
//   TEXT     store it, trimmed. A box holding two spaces is an empty box, and
//            storing the spaces prints a blank line under a heading saying
//            somebody explained this line.
//
// Returned as an object to spread into a Prisma `data`, so ABSENT is genuinely
// an absent key rather than an explicit undefined.
export function countNoteWrite(sent: string | null | undefined): { note?: string | null } {
  if (sent === undefined) return {};
  if (sent === null) return { note: null };
  return { note: sent.trim() || null };
}
