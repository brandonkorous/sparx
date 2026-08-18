// Which shape a list surface was last left in — board or table.
//
// Per-user, per-surface, and deliberately LOCAL: this is a preference about how
// someone likes to look at their work, not data about the business, so it does
// not belong on the server or in the per-site layout. Keyed by surface so the
// deals board and (docs/144 §7.2) the tickets board remember separately.
//
// Follows the defensive localStorage convention in lib/workbench/persistence.ts
// — swallow quota/blocked errors, degrade to the default, never throw. A lost
// preference is a mild annoyance; a crash on a private-mode browser is not.

const KEY = 'sparx-workbench-list-view';

export type ListView = 'board' | 'table';

/** surfaceKey → the view it was last left in. */
type ViewMap = Record<string, ListView>;

function read(): ViewMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ViewMap) : {};
  } catch {
    return {};
  }
}

export function readListView(surfaceKey: string, fallback: ListView): ListView {
  const stored = read()[surfaceKey];
  return stored === 'board' || stored === 'table' ? stored : fallback;
}

export function writeListView(surfaceKey: string, view: ListView): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), [surfaceKey]: view }));
  } catch {
    // Storage full or blocked — the choice just won't survive a reload.
  }
}
