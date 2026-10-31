// The brand of the request being served, for a process that serves every brand.
//
// api-rest runs both brands' Better Auth instances in one process. Code deep
// inside an instance (the brand-scoped adapter, tenant provisioning, merchant
// sign-up) asks `currentPlatformBrand()`, and in a shared process the
// environment cannot answer: it holds one label for a question that has a
// different answer per request. So the caller that knows the brand (the route
// that picked an instance) runs the work inside `runAsBrand`, and everything
// below it, across every await, reads that brand.
//
// Node-only: it imports `node:async_hooks`. That is why it is its own entry
// point rather than part of `./index.ts`, which the browser and the edge load.

import { AsyncLocalStorage } from 'node:async_hooks';
import { normalizeBrandKey, setRequestBrandResolver } from './index';

const scope = new AsyncLocalStorage<string>();

setRequestBrandResolver(() => scope.getStore() ?? null);

/**
 * Run `fn` as `brand`. `currentPlatformBrand()` returns `brand` for everything
 * `fn` does, including work after an await.
 *
 * An empty brand throws rather than falling back to the default brand: a caller
 * that lost track of the brand must stop, not become sparx.
 */
export function runAsBrand<T>(brand: string, fn: () => T): T {
  if (typeof brand !== 'string' || brand.trim() === '') {
    throw new Error('runAsBrand(): no brand given. Refusing to run unscoped.');
  }
  return scope.run(normalizeBrandKey(brand), fn);
}

/** The brand of the current scope, or null outside `runAsBrand`. */
export function scopedPlatformBrand(): string | null {
  return scope.getStore() ?? null;
}
