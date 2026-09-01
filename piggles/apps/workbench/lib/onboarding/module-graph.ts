// What depends on what, and what that does to a switch.
//
// Split from `modules.ts` under RULE #0.5: that file is the CATALOG — what each
// app is called and what it says — and this is the arithmetic on top of it. One
// changes when the words change, the other when the rules do.
//
//   REQUIRES      a key needs these providers, which lock ON while it is on.
//                 Only Trade customers requires Sell.
//   BUNDLED_FREE  a key rides along whenever a provider is on. Invoices and Stock
//                 come with Sell or Trade customers, else they are their own row.
//
// Mirrors the server's @wizeworks/modules graph; the API enforces it on save and
// this is the browser's copy so a switch resolves without a round trip.

import { MODULE_BY_KEY } from './modules';

//   REQUIRES — a key needs these providers; each is SEPARATELY BILLED and locks
//     ON while the key is on. Only B2B requires Commerce.
//   BUNDLED_FREE — a key is on free ($0, "Included") whenever a provider is on;
//     Invoicing/Inventory ride along with Commerce/B2B, else they're add-ons.
const REQUIRES: Record<string, string[]> = {
  b2b: ['commerce'],
};
const BUNDLED_FREE: Record<string, string[]> = {
  invoicing: ['b2b', 'commerce'],
  inventory: ['commerce', 'b2b'],
};

/** Providers that bundle `key` free and are currently on. */
function activeBundlers(modules: Record<string, boolean>, key: string): string[] {
  return (BUNDLED_FREE[key] ?? []).filter((p) => modules[p]);
}

/** Enabled modules that REQUIRE `key` (so it's locked on). */
function activeRequirers(modules: Record<string, boolean>, key: string): string[] {
  return Object.keys(REQUIRES).filter((k) => (REQUIRES[k] ?? []).includes(key) && modules[k]);
}

/** Transitive paid requirements pulled on when `key` is enabled. */
function requiredKeys(key: string): string[] {
  const out = new Set<string>();
  const visit = (k: string): void => {
    for (const dep of REQUIRES[k] ?? []) {
      if (!out.has(dep)) {
        out.add(dep);
        visit(dep);
      }
    }
  };
  visit(key);
  return [...out];
}

function joinNames(slugs: string[]): string {
  const names = slugs.map((s) => MODULE_BY_KEY[s]?.name ?? s);
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`;
}

/** A module's effective on-state once the dependency graph is applied. */
export function effectiveModuleOn(modules: Record<string, boolean>, key: string): boolean {
  return (
    Boolean(modules[key]) ||
    activeBundlers(modules, key).length > 0 ||
    activeRequirers(modules, key).length > 0
  );
}

/** Why a module's toggle is locked on, if it is — bundled ("Included") wins. */
export function moduleLock(
  modules: Record<string, boolean>,
  key: string
): 'included' | 'required' | null {
  if (activeBundlers(modules, key).length > 0) return 'included';
  if (activeRequirers(modules, key).length > 0) return 'required';
  return null;
}

/** The "Included with …" / "Required by …" caption for a locked row, or null. */
export function lockReasonText(modules: Record<string, boolean>, key: string): string | null {
  const lock = moduleLock(modules, key);
  if (lock === 'included') return `Included with ${joinNames(activeBundlers(modules, key))}`;
  if (lock === 'required') return `Required by ${joinNames(activeRequirers(modules, key))}`;
  return null;
}

/** Apply a toggle through the dependency graph: locked rows ignore the click;
 *  enabling a module co-enables its transitive paid requirements (enabling B2B
 *  pulls Commerce on). */
export function toggleModule(
  modules: Record<string, boolean>,
  key: string
): Record<string, boolean> {
  if (moduleLock(modules, key) !== null) return modules;
  const next = { ...modules, [key]: !modules[key] };
  if (next[key]) for (const dep of requiredKeys(key)) next[dep] = true;
  return next;
}

// There is deliberately no DEFAULT_ON. A new business starts with NOTHING switched
// on and turns on exactly what it wants — that is the whole premise, and a constant
// naming three preselected apps is a standing invitation to break it. One sat here
// exported and unread while `story-state.ts` correctly starts everything off.

/** Selling modules — any one being on is what gates the Payments step. */
export const SELLING_MODULE_KEYS = ['commerce', 'b2b', 'dropship'];

/** Whether any selling module is effectively on (so Payments should appear). */
export function isSellingSelected(modules: Record<string, boolean>): boolean {
  return SELLING_MODULE_KEYS.some((k) => effectiveModuleOn(modules, k));
}
