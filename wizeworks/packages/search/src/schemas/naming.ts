// How every Typesense collection name is resolved, and the guard that keeps a
// test run away from real ones.
//
// There is ONE mechanism: the `TYPESENSE_COLLECTION_PREFIX` env var, read once
// when this module loads, glued in front of each base name (`products`,
// `customers`, `orders`, `entities`). Every read, write and delete in this
// package goes through the `*_COLLECTION` constants built from it, so setting
// the prefix moves ALL of them at once. Production never sets it, so the names
// there are the bare base names, exactly as before.
//
// Tests set it to a per-run `test_<random>_` value (see this package's
// vitest.config.ts). That is what lets a suite create, fill and drop its own
// collections on the developer's local Typesense without touching any tenant's
// real index. On 2026-10-04 a run without that isolation dropped every
// collection on the local instance, and every tenant's search read empty until
// it was rebuilt by hand.

/** A test-only collection name: `test_`, a run id of letters and digits, `_`. */
export const TEST_COLLECTION_PREFIX_PATTERN = /^test_[a-z0-9]+_/;

function resolvePrefix(raw: string | undefined): string {
  const prefix = raw?.trim() ?? '';
  if (!/^[a-z0-9_]*$/.test(prefix)) {
    throw new Error(
      `TYPESENSE_COLLECTION_PREFIX "${prefix}" may only hold lowercase letters, digits and "_".`
    );
  }
  return prefix;
}

/** The prefix in front of every collection name. Empty in production. */
export const COLLECTION_PREFIX = resolvePrefix(process.env.TYPESENSE_COLLECTION_PREFIX);

/** The real collection name for a base name, prefix included. */
export function resolveCollectionName(base: string): string {
  return `${COLLECTION_PREFIX}${base}`;
}

/** True when a collection name carries a test-only prefix. */
export function isTestCollection(name: string): boolean {
  return TEST_COLLECTION_PREFIX_PATTERN.test(name);
}

/**
 * The backstop. A test helper that drops a collection or deletes documents calls
 * this first, and it throws for any name without a test prefix. A suite that
 * somehow runs without its prefix (a different config, a hand-run file) stops
 * here, loudly and before anything is gone, instead of emptying a real index.
 */
export function assertTestCollection(name: string, action: string): void {
  if (!isTestCollection(name)) {
    throw new Error(
      `REFUSED to ${action} Typesense collection "${name}": it does not carry a test prefix ` +
        `(${String(TEST_COLLECTION_PREFIX_PATTERN)}). Tests may only touch collections they ` +
        `created under TYPESENSE_COLLECTION_PREFIX=test_<run>_. A real collection holds ` +
        `tenants' search data and must never be dropped or emptied by a test run.`
    );
  }
}
