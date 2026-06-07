// The safety boundary on author-typed classes (docs/61 §8 / docs/47 §6).
//
// The per-tenant compile turns author/AI class strings into CSS. Most Tailwind
// utilities are inherently safe + tokenized; a small set is weaponizable even as
// "just classes": `fixed inset-0 z-[9999]` (clickjacking overlay), arbitrary
// `url()` (exfiltration / external load), `content-[…]` (injection). The
// compiler already DROPS anything it doesn't recognize, so the *effective*
// allowlist is "everything Tailwind emits MINUS this denylist of the genuinely
// dangerous" — a denylist is the maintainable shape (we don't enumerate every
// safe utility). Enforced at the compile choke point (compile.ts); exposed for
// the publish gate to report on (validateClasses).

/** The base utility of a token — the part after the last variant prefix
 *  (`md:`, `hover:`, `@md:`, `dark:`, `before:`, …). Only ':' OUTSIDE arbitrary
 *  brackets separates variants, since `[…]` values may legitimately contain ':'. */
export function baseUtility(token: string): string {
  let depth = 0;
  let lastSplit = -1;
  for (let i = 0; i < token.length; i++) {
    const ch = token[i];
    if (ch === '[') depth++;
    else if (ch === ']') depth--;
    else if (ch === ':' && depth === 0) lastSplit = i;
  }
  return token.slice(lastSplit + 1);
}

// Matched against the BASE utility (variants already stripped).
const BLOCK: RegExp[] = [
  /^!?fixed$/, // position: fixed — clickjacking overlay
  /^!?-?z-\[/, // arbitrary z-index escalation (z-[9999]); the z-0…z-50 scale stays allowed
  /^!?content-\[/, // arbitrary content — injection vector
];

/** Whether an author class token is permitted to compile (docs/61 §8). */
export function isClassAllowed(token: string): boolean {
  if (!token) return false;
  // Any url() anywhere in the token (e.g. `bg-[url(…)]`) — exfiltration / external load.
  if (/url\(/i.test(token)) return false;
  const base = baseUtility(token);
  return !BLOCK.some((re) => re.test(base));
}

export interface ClassValidation {
  /** Tokens permitted to compile. */
  allowed: string[];
  /** Tokens dropped by the allowlist. */
  blocked: string[];
}

/** Partition a class list into allowed + blocked (docs/61 §8). */
export function validateClasses(classes: string[]): ClassValidation {
  const allowed: string[] = [];
  const blocked: string[] = [];
  for (const c of classes) (isClassAllowed(c) ? allowed : blocked).push(c);
  return { allowed, blocked };
}
