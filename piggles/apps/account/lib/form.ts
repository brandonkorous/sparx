// Read a text field out of a FormData.
//
// `formData.get()` returns `string | File | null`, and `String(…)` on a File
// yields the literal "[object File]" — a value that passes every "is it
// non-empty" check and then gets written to the database as a business name.
// Nothing about that fails loudly, which is why the lint rule that flags it is
// worth obeying rather than silencing.
//
// A File where a string was expected is either a mistake or someone probing, and
// neither deserves a guess: it reads as absent.

export function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

/** Every value posted under `key` that is genuinely text. Used for checkbox
 *  groups, where the browser sends one entry per ticked box. */
export function textAll(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((v): v is string => typeof v === 'string');
}
