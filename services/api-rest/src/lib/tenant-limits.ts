// Per-tenant limit overrides stored in `tenants.settings.limits` (the non-RLS
// dispatch row). Phase 1 has exactly one: `storageBytes`, an operator-set storage
// cap (build-plan §5 Slice 8). It is STORED + DISPLAYED today; the upload-path
// enforcement (refuse writes over the cap) is a scoped follow-up —
// docs/apps/admin/slice-8-enforcement-followups.md.
//
// Read-modify-write on the settings JSON, the same pattern the module flags use:
// `jsonb_set` silently no-ops when the parent path (`settings.limits`) is absent,
// so RMW always produces a valid nested structure regardless of starting shape.

/** The operator-set storage cap in bytes, or null when no override is set (the
 *  platform default applies once enforcement lands). */
export function readStorageLimitBytes(settings: unknown): number | null {
  if (!settings || typeof settings !== 'object') return null;
  const limits = (settings as Record<string, unknown>).limits;
  if (!limits || typeof limits !== 'object') return null;
  const raw = (limits as Record<string, unknown>).storageBytes;
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : null;
}

/** RMW the storage-cap override into the settings blob (null clears it). Returns
 *  the next settings object; the caller persists it. */
export function withStorageLimitBytes(
  settings: unknown,
  limitBytes: number | null
): Record<string, unknown> {
  const current = (settings as Record<string, unknown> | null) ?? {};
  const limits = { ...((current.limits as Record<string, unknown> | undefined) ?? {}) };
  if (limitBytes === null) {
    delete limits.storageBytes;
  } else {
    limits.storageBytes = limitBytes;
  }
  return { ...current, limits };
}
