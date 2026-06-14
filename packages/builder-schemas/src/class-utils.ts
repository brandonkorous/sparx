// Class-string utilities for the class-first authoring model (docs/47).
//
// A node's `class` string (docs/47 §3) is a space-separated list of tokens drawn
// from the brand-governed vocabulary. The Phase C control registry (docs/47 §11)
// models the structured inspector as a set of CONTROLS, each owning a
// mutually-exclusive GROUP of tokens — e.g. the colour control owns
// `st-c-primary | st-c-secondary | …`, the variant control owns `st-v-solid | …`.
// Setting a control swaps the active token within its group while leaving every
// other token untouched. These pure helpers are that read/write primitive,
// shared by the editor controls and anything else that edits a class string.

/** Split a class string into its non-empty tokens (whitespace-separated). */
export function parseClasses(value: string | null | undefined): string[] {
  return (value ?? '').split(/\s+/).filter(Boolean);
}

/** Join tokens back into a normalized class string. */
export function joinClasses(tokens: string[]): string {
  return tokens.join(' ');
}

/** The token from `group` currently present in `value` (first match), or null —
 *  i.e. which option of a mutually-exclusive control is active. */
export function readClassGroup(
  value: string | null | undefined,
  group: readonly string[]
): string | null {
  const members = new Set(group);
  for (const token of parseClasses(value)) {
    if (members.has(token)) return token;
  }
  return null;
}

/** Remove every `group` member from `value`, then append `token` (when non-null).
 *  Order of the surviving non-group tokens is preserved; the chosen token lands
 *  at the end. Passing `token: null` clears the group (the "none" option). */
export function setClassGroup(
  value: string | null | undefined,
  group: readonly string[],
  token: string | null
): string {
  const members = new Set(group);
  const kept = parseClasses(value).filter((t) => !members.has(t));
  if (token && !kept.includes(token)) kept.push(token);
  return joinClasses(kept);
}

/** Add (`on`) or remove (`!on`) a single token, idempotently. */
export function toggleClass(value: string | null | undefined, token: string, on: boolean): string {
  const tokens = parseClasses(value).filter((t) => t !== token);
  if (on) tokens.push(token);
  return joinClasses(tokens);
}
