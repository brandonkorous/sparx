// Has this business never been set up? Setup is what switches its apps on, so a
// business with NO app on and no finished-setup marker has plainly skipped it (a
// Google account made from the sign-in page). Seeded businesses have apps on.

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function needsSetup(settings: unknown): boolean {
  const s = record(settings);
  if (typeof record(s.piggles).onboardedAt === 'string') return false;
  const modules = Object.values(record(s.modules));
  return !modules.some((slot) => record(slot).enabled === true);
}
