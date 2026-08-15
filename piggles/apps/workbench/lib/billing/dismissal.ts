// "Dismissed until tomorrow" state for the trial heads-up banner. TENANT-level
// (billing is a tenant concern) — NOT per-site — so switching sites under the same
// owner never resurfaces a banner they just dismissed. Mirrors the defensive
// localStorage convention in lib/workbench/persistence.ts (swallow quota/blocked
// errors; a lost dismissal is a mild annoyance, never a crash).

const KEY = 'piggles-console-billing-dismissed';
const DAY_MS = 24 * 60 * 60 * 1000;

/** tenantId → epoch ms until which the heads-up banner stays hidden. */
type DismissMap = Record<string, number>;

function read(): DismissMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DismissMap) : {};
  } catch {
    return {};
  }
}

function write(map: DismissMap): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // Storage full or blocked — degrade to "not dismissed", never throw.
  }
}

export function isBannerDismissed(tenantId: string, now: number = Date.now()): boolean {
  const until = read()[tenantId];
  return typeof until === 'number' && now < until;
}

export function dismissBannerUntilTomorrow(tenantId: string, now: number = Date.now()): void {
  write({ ...read(), [tenantId]: now + DAY_MS });
}
