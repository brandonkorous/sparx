// WHICH BOX THE SERVER REFUSED, WHEN IT REFUSED ONE.
//
// `apiErrorMessage` deliberately drops the schema layer's own sentence, because
// "Request validation failed." explains nothing to a business owner and reads
// like her fault. Its comment then says, in as many words, that "the useful part
// is in `details`, keyed by field path" — and nothing anywhere reads it.
//
// Measured 2026-09-17:
//
//     apiErrorMessage call sites   piggles 83, sparx 86
//     places reading the field list                   0
//
// So a refused save on a twenty-field form said "Could not save this account.
// Nothing was changed." and stopped. Every box on the screen is a suspect, and
// the one fact that would narrow it down came back with the error and was thrown
// away ([[feedback_fetched_but_never_rendered]]).
//
// ── Why it names the box and not the reason ─────────────────────────────────
//
// The reason belongs to the schema, and the schema does not speak to owners.
// None of the 142 route files that parse a body attaches its own wording, so
// every message here is Zod's default:
//
//     "Invalid input: expected string, received undefined"
//     "Too small: expected string to have >=1 characters"
//     "Invalid uuid"
//
// Repeating those puts the fault back on her in a vocabulary she has no use for,
// which is the exact thing `apiErrorMessage` exists to stop. The FIELD is a
// different kind of fact: it is a place on her screen, and naming it turns
// twenty suspects into one.

/** The most fields to name before the sentence turns into a list. */
const MOST = 3;

/** Path segments that name the request, not anything she can see. */
const PLUMBING = new Set(['body', 'params', 'query', 'headers', '']);

/**
 * One refused field as it reaches us. Both shapes are `unknown` on purpose:
 * this runs on whatever the server sent, not on a type we control.
 *
 * Zod sends `{ path, field, message, code }`; Fastify's own schema validation
 * sends `{ instancePath: '/items/2/quantity', message, keyword }`.
 */
type Refusal = Record<string, unknown>;

/** `physicalAddress` / `physical_address` / `items.2.quantity` as words. */
export function fieldLabel(path: string): string | null {
  const parts = path
    .split(/[./]/)
    .map((p) => p.trim())
    .filter((p) => !PLUMBING.has(p.toLowerCase()));
  if (parts.length === 0) return null;

  // A trailing index is the row, not the field: `items.2` means the whole of
  // row three is wrong, and there is no box to name inside it.
  const last = parts[parts.length - 1];
  if (last === undefined || /^\d+$/.test(last)) return null;

  const words = last
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
  if (words === '') return null;

  const named = words.charAt(0).toUpperCase() + words.slice(1);

  // Counted from one, the way she counts rows on the screen.
  const row = parts.filter((p) => /^\d+$/.test(p)).pop();
  return row === undefined ? named : `${named} (item ${Number(row) + 1})`;
}

/** Every field the server refused, named once each, in the order it sent them. */
export function refusedFields(details: unknown): string[] {
  if (!Array.isArray(details)) return [];

  const seen = new Set<string>();
  for (const entry of details as Refusal[]) {
    if (entry === null || typeof entry !== 'object') continue;

    const raw = [entry.path, entry.field, entry.instancePath].find(
      (v) => typeof v === 'string' && v !== ''
    );
    const label = typeof raw === 'string' ? fieldLabel(raw) : null;
    if (label !== null) seen.add(label);
  }
  return [...seen];
}

/**
 * The sentence to add after the caller's own, or null when the server named no
 * field this side can point at.
 *
 * Null is the honest answer more often than it looks: a rule that refuses the
 * whole request carries an empty path, and inventing a field for it would send
 * her to the wrong box.
 */
export function refusedWhat(details: unknown): string | null {
  const fields = refusedFields(details);
  if (fields.length === 0) return null;

  // The last one is joined with "and" rather than a comma, whether it is a real
  // field or the count of the ones there was no room for.
  const rest = fields.length - MOST;
  const head = rest > 0 ? fields.slice(0, MOST) : fields.slice(0, -1);
  const tail = rest > 0 ? `${rest} more` : fields[fields.length - 1];

  const listed = head.length === 0 ? tail : `${head.join(', ')} and ${tail}`;
  return `The problem is with ${listed}.`;
}
