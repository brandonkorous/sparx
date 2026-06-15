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

/** Whether an author class token is permitted to compile (docs/61 §8). The
 *  platform base denylist always applies; an optional per-tenant `config` adds
 *  MORE blocks (tighten-only — see {@link AllowlistConfig}). */
export function isClassAllowed(token: string, config?: AllowlistConfig): boolean {
  if (!token) return false;
  // Any url() anywhere in the token (e.g. `bg-[url(…)]`) — exfiltration / external load.
  if (/url\(/i.test(token)) return false;
  const base = baseUtility(token);
  if (BLOCK.some((re) => re.test(base))) return false;
  // Tenant additions (governance, Phase 6b): only ever tighten further.
  if (config) {
    for (const rule of config.blocks) if (ruleMatches(rule, token, base)) return false;
  }
  return true;
}

export interface ClassValidation {
  /** Tokens permitted to compile. */
  allowed: string[];
  /** Tokens dropped by the allowlist. */
  blocked: string[];
}

/** Partition a class list into allowed + blocked (docs/61 §8). An optional
 *  per-tenant `config` tightens the denylist (Phase 6b). */
export function validateClasses(classes: string[], config?: AllowlistConfig): ClassValidation {
  const allowed: string[] = [];
  const blocked: string[] = [];
  for (const c of classes) (isClassAllowed(c, config) ? allowed : blocked).push(c);
  return { allowed, blocked };
}

// ── Tenant allowlist governance (docs/61 §8, Phase 6b) ─────────────────────────
// The BLOCK list + url() check above are the PLATFORM base denylist — clickjacking
// / exfiltration / injection guards, hardcoded and NEVER relaxable. A tenant's
// brand-designer may only TIGHTEN: add MORE blocks (ban `animate-*`, a specific
// token, …). The effective denylist is `platform base ∪ tenant additions`; there
// is deliberately no "unblock" — the insecure state is un-representable.

/** One tenant-added block rule. `prefix`/`exact` match the BASE utility (variant
 *  prefixes stripped); `substring` matches anywhere in the whole token (like the
 *  base `url(` rule — e.g. to ban a `[url` fragment). Tenant rules are enumerated,
 *  never free regex (a user regex is a ReDoS / footgun). */
export interface AllowlistRule {
  kind: 'prefix' | 'exact' | 'substring';
  value: string;
}

/** A tenant's ADDITIONAL allowlist tightening — the parsed form of the
 *  `builder_governance.utility_allowlist` JSON (docs/61 §8). */
export interface AllowlistConfig {
  blocks: AllowlistRule[];
}

/** A platform base rule described for the governance UI — read-only, shown so the
 *  brand-designer understands what is always blocked and why. */
export interface BaseRuleDescription {
  /** Short label for the blocked pattern. */
  label: string;
  /** The security rationale surfaced to the brand-designer. */
  reason: string;
}

/** The platform base denylist, described for the governance UI (docs/61 §8). These
 *  mirror BLOCK + the url() check above and are NEVER editable by a tenant. */
export const BASE_RULES_DESCRIPTION: BaseRuleDescription[] = [
  {
    label: 'fixed',
    reason:
      'Blocks `position: fixed` — stops an element pinning itself over the app chrome (clickjacking).',
  },
  {
    label: 'z-[…] arbitrary z-index',
    reason:
      'Blocks arbitrary z-index escalation like `z-[9999]`; the bounded `z-0`…`z-50` scale stays available.',
  },
  {
    label: 'content-[…]',
    reason: 'Blocks arbitrary `content-[…]` — a CSS content-injection vector.',
  },
  {
    label: 'url(…)',
    reason:
      'Blocks any `url(…)` (e.g. `bg-[url(…)]`) — prevents external loads / data exfiltration. Use the image picker for backgrounds.',
  },
];

/** Whether a tenant rule matches a token. prefix/exact compare the BASE utility;
 *  substring scans the whole token. */
function ruleMatches(rule: AllowlistRule, token: string, base: string): boolean {
  switch (rule.kind) {
    case 'prefix':
      return base.startsWith(rule.value);
    case 'exact':
      return base === rule.value;
    case 'substring':
      return token.includes(rule.value);
    default:
      return false;
  }
}

/** Parse the tenant's stored allowlist JSON (`builder_governance.utility_allowlist`)
 *  into a typed config, defensively. Returns `undefined` for null / garbage / an
 *  empty block list — callers then fall back to the platform base only. */
export function parseAllowlistConfig(json: unknown): AllowlistConfig | undefined {
  if (!json || typeof json !== 'object') return undefined;
  const blocksRaw = (json as { blocks?: unknown }).blocks;
  if (!Array.isArray(blocksRaw)) return undefined;
  const blocks: AllowlistRule[] = [];
  for (const b of blocksRaw) {
    if (!b || typeof b !== 'object') continue;
    const { kind, value } = b as { kind?: unknown; value?: unknown };
    if (
      (kind === 'prefix' || kind === 'exact' || kind === 'substring') &&
      typeof value === 'string' &&
      value.length > 0
    ) {
      blocks.push({ kind, value });
    }
  }
  return blocks.length > 0 ? { blocks } : undefined;
}
