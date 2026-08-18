// The platform-specific params a connection carries alongside its token (a LinkedIn org
// urn, a Google Business location id). They ride in `social_connections.metadata` under
// `socialParams` rather than as columns, because every platform wants a different set and
// none of them are queried.
//
// Lives in @wizeworks/social because three callers now need the same read — the worker's auth
// resolver, its health sweep, and the readiness check in this package. A fourth copy of a
// nine-line JSON narrowing is how they drift.

/** Read the platform params back off a connection's metadata JSON. Returns undefined
 *  rather than an empty object when there are none, so callers can pass it straight into
 *  an optional `params` field. Tolerates any shape — this is untyped JSON off a row, and
 *  a malformed blob must degrade to "no params", never throw. */
export function paramsFromSocialMetadata(metadata: unknown): Record<string, string> | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  const raw = (metadata as Record<string, unknown>).socialParams;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}
