// Email merge tokens — `{{ source.path ?? "fallback" }}` (docs/91 §2, §3).
//
// Builder emails personalize by embedding merge tokens directly in string props
// (a Heading's `text`, a Button's `label`/`href`, the subject/preheader) rather
// than only through node `binding`s. A token names a dotted path into the resolved
// email DataSources (`customer.firstName`, `invoice.balance`, `tenant.storeUrl`),
// with an optional literal fallback used when the path resolves empty.
//
// This module is the PURE token layer shared by both ends of the pipeline:
//   · the renderer (`@sparx/email`'s `renderEmailTree`) interpolates tokens against
//     a resolved scope at dispatch;
//   · the dispatch resolver (`api-rest`'s `resolveEmailData`) collects the token
//     PATHS a tree references so it loads only the sources actually used.
// Pure functions + types (no zod, no DB, no React) — client + server safe, like
// the rest of `binding.ts` / `runtime.ts`.

import { bindingSourceKey } from './runtime';
import type { BuilderNode } from './node';

/** The grammar: `{{ <path> [?? <fallback>] }}`. Global; constructed per use so
 *  callers never trip over a shared `lastIndex`. */
const TOKEN_SOURCE = '\\{\\{\\s*([^}]+?)\\s*\\}\\}';

export interface EmailToken {
  /** The full matched token incl. braces — `{{ customer.firstName ?? "there" }}`. */
  raw: string;
  /** The dotted source path — `customer.firstName`. */
  path: string;
  /** The literal fallback when the path resolves empty (quotes stripped); undefined
   *  when the token has no `?? …` clause. */
  fallback?: string;
}

/** Split a token body (`customer.firstName ?? "there"`) into path + fallback.
 *  Only the FIRST `??` separates them, so a fallback may itself contain `??`. */
function parseBody(body: string): { path: string; fallback?: string } {
  const idx = body.indexOf('??');
  if (idx === -1) return { path: body.trim() };
  const path = body.slice(0, idx).trim();
  let fallback = body.slice(idx + 2).trim();
  // Strip one layer of matching surrounding quotes (single or double).
  const q = fallback[0];
  if ((q === '"' || q === "'") && fallback.endsWith(q) && fallback.length >= 2) {
    fallback = fallback.slice(1, -1);
  }
  return { path, fallback };
}

/** Every merge token in a string, in source order (duplicates kept). */
export function parseEmailTokens(input: string): EmailToken[] {
  const re = new RegExp(TOKEN_SOURCE, 'g');
  const out: EmailToken[] = [];
  for (const m of input.matchAll(re)) {
    const { path, fallback } = parseBody(m[1] ?? '');
    if (path) out.push({ raw: m[0], path, fallback });
  }
  return out;
}

/** A resolved value as display text — mirrors the renderer's `asText` so a token
 *  and a binding stringify identically. Objects/arrays/booleans → '' (not bound
 *  here; they belong in a `binding`, never a `{{token}}`). */
function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

/**
 * Replace every `{{ path ?? "fb" }}` in `input` with `resolve(path)` as text,
 * falling back to the token's literal (or '' when neither resolves). `resolve`
 * is supplied by the caller — the renderer passes `p => resolvePath(scope, p)`,
 * the dispatch tick passes a resolver over the per-recipient DataSources.
 */
export function interpolateEmailTokens(input: string, resolve: (path: string) => unknown): string {
  const re = new RegExp(TOKEN_SOURCE, 'g');
  return input.replace(re, (_full, body: string) => {
    const { path, fallback } = parseBody(body);
    if (!path) return fallback ?? '';
    const text = asText(resolve(path));
    return text !== '' ? text : (fallback ?? '');
  });
}

// ── Source collection (which DataSources a tree actually references) ───────────
//
// `resolveEmailData` resolves ONLY the sources a tree binds, so a static email
// costs nothing. A binding is visible on `node.binding.path`; a token hides inside
// a string prop. This walk surfaces BOTH, plus the bare path a `conditional_block`
// carries on `props.when`, so the resolver's source set is complete.

/** String props that may carry merge tokens (any author-facing copy or link). */
const TOKEN_PROP_KEYS = ['text', 'label', 'href', 'src', 'alt', 'subject', 'preheader'];

/** Every data PATH an email tree references — node bindings, `{{token}}` paths in
 *  string props, and a `conditional_block`'s `props.when`. `extra` carries strings
 *  outside the tree (subject / preheader) so tokens used only there still load
 *  their source. Duplicates kept; callers map through `bindingSourceKey` + dedupe. */
export function collectEmailPaths(tree: BuilderNode, extra: string[] = []): string[] {
  const out: string[] = [];
  const pushTokens = (s: unknown): void => {
    if (typeof s !== 'string' || !s.includes('{{')) return;
    for (const t of parseEmailTokens(s)) out.push(t.path);
  };
  const walk = (n: BuilderNode): void => {
    if (n.binding?.path) out.push(n.binding.path);
    if (n.type === 'conditional_block' && typeof n.props.when === 'string') {
      out.push(n.props.when);
    }
    for (const key of TOKEN_PROP_KEYS) pushTokens(n.props[key]);
    for (const c of n.children ?? []) walk(c);
  };
  walk(tree);
  for (const s of extra) pushTokens(s);
  return out;
}

/** The distinct SOURCE KEYS an email tree references (`collectEmailPaths` mapped
 *  through `bindingSourceKey`, scope-relative `item.*`/`index` dropped). This is
 *  exactly the set `resolveEmailData` must load. */
export function collectEmailSourceKeys(tree: BuilderNode, extra: string[] = []): Set<string> {
  return new Set(collectEmailPaths(tree, extra).map(bindingSourceKey).filter(Boolean));
}
