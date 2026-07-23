// Live-relay side-channel for scripted builder writes (docs/126 §4.5).
//
// A silica write tool authors on an agent's behalf and, through `siteService`, produces a
// `SilicaWriteChange` — the ops a co-editor should fold in, plus any reload hints. But the
// tool's RETURN value is the agent-facing result; the relay is transport plumbing the
// agent must never see. So it rides back as a NON-ENUMERABLE property: `JSON.stringify`
// (how api-mcp serializes a tool result for the model) skips it, while the dispatch layer
// reads it directly and emits it to the site's editor room. Mirrors how the REST sync
// route strips `relay` from its HTTP response for the same reason — the writer already
// holds it; only co-editors need it.
//
// This keeps @sparx/builder free of any socket/transport dependency: the tool DESCRIBES
// what to relay; api-mcp (which owns the Redis emitter) decides how.

import type { SilicaWriteChange } from '../services/site-service';

/** The non-enumerable key the change rides under. */
const BUILDER_RELAY_KEY = '__builderRelay';

/** What the transport needs to relay one scripted write: which site's room, the op batch
 *  to replay as `ops:relay`, and the pages/frame to offer as a reload. */
export interface BuilderRelaySideChannel {
  propertyId: string;
  relay: SilicaWriteChange['relay'];
  reloadHints: string[];
}

/** Attach the relay side-channel to a tool result WITHOUT making it serializable — the
 *  model never sees it (non-enumerable ⇒ omitted by `JSON.stringify`), api-mcp reads it
 *  via {@link readRelay}. Call this LAST: an object spread (e.g. `withSite`) drops
 *  non-enumerable props, so wrapping must be the outermost step. */
export function withRelay<T extends object>(result: T, side: BuilderRelaySideChannel): T {
  Object.defineProperty(result, BUILDER_RELAY_KEY, {
    value: side,
    enumerable: false,
    configurable: true,
    writable: false,
  });
  return result;
}

/** Read the relay side-channel a builder write attached, or null for any other result.
 *  Safe to call on EVERY tool result — a non-builder tool simply has no such key. */
export function readRelay(result: unknown): BuilderRelaySideChannel | null {
  if (!result || typeof result !== 'object') return null;
  const side = (result as Record<string, unknown>)[BUILDER_RELAY_KEY];
  return (side as BuilderRelaySideChannel | undefined) ?? null;
}
