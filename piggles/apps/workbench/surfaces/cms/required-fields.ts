// Which required boxes are still empty, said in her words.
//
// ---------------------------------------------------------------------------
// The bug this exists for
// ---------------------------------------------------------------------------
//
// Create an Event with "Starts" left empty and the whole answer is:
//
//     Could not create this
//     Could not create this. Nothing was saved.
//
// The same sentence twice, naming nothing. Nothing is marked on the form, so
// there is no way to find the box short of reading every label for the word
// "(required)" and checking each one.
//
// The server knew. It answers a per-field `details` list saying exactly which
// key was missing, and `apiErrorMessage` deliberately throws that away, because
// a business owner reading "body.startAt: Required" learns nothing and it reads
// like her fault. That call is right; discarding was the wrong conclusion from
// it. The content type carries `label: 'Starts'` for that very key, so the
// answer can be said properly.
//
// Better still, none of it needs the server. The schema is in the editor's hand
// while she is typing, so the check happens before the request and she never
// waits on a round trip to be told nothing.
//
// ---------------------------------------------------------------------------
// What counts as empty
// ---------------------------------------------------------------------------
//
// Exactly what `pruneEmpty` strips, because that is what the request actually
// carries: a field pruned out of the body is a field the server will not see.
// Asking the same question twice in two places is how the two come to disagree,
// and the disagreement always favours the wrong answer — either a form that
// blocks a save the server would have accepted, or the silence this replaces.
//
// So `0` and `false` are FILLED. A price of zero is a price and an unticked box
// is an answer, and a check that called either of them empty would refuse to
// let her save a free thing.

/** Just enough of a content type's field for this question. */
export interface RequiredFieldSpec {
  key: string;
  label: string;
  required?: boolean;
}

/**
 * The labels of the required fields missing from a body about to be sent.
 *
 * `sent` is the body AFTER pruning — the object that goes on the wire. Order
 * follows the schema, so the sentence reads down the form the way her eye does.
 */
export function missingRequired(
  fields: RequiredFieldSpec[],
  sent: Record<string, unknown>
): string[] {
  return fields
    .filter((field) => field.required === true && sent[field.key] === undefined)
    .map((field) => field.label);
}

/**
 * That list as one sentence, or `null` when there is nothing to say.
 *
 * Names every missing field rather than the first. Being sent back for one box
 * at a time is its own small cruelty on a form this long, and the check costs
 * nothing to run over all of them.
 */
export function missingRequiredNote(
  fields: RequiredFieldSpec[],
  sent: Record<string, unknown>
): string | null {
  const missing = missingRequired(fields, sent);
  if (missing.length === 0) return null;
  if (missing.length === 1) return `${missing[0] ?? ''} needs filling in before this can be saved.`;
  return `${andList(missing)} need filling in before this can be saved.`;
}

/** "Starts and Ends", "Title, Starts and Ends" — the way it is said aloud. */
function andList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  const last = items[items.length - 1] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${last}`;
}
