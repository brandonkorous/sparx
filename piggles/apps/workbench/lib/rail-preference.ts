// Whether the app rail shows labels — a Piggles preference, in a Piggles key.
//
// ── WHY NOT `loadNavState` ──────────────────────────────────────────────────
//
// The shared workbench already persists a `railExpanded` flag, and reusing it
// looks obviously right until you read its default: `stored?.railExpanded ??
// false`. sparx collapses "no preference expressed" into "collapsed", because
// an icon rail is what sparx wants on a first visit.
//
// Piggles wants the opposite on a first visit — see the shell — and that default
// lives in shared platform code where a Piggles need has no business changing
// it. Worse, the shared getter cannot even be asked the question: it returns
// `false` for "collapsed" and for "never chosen" alike, so the console cannot
// tell a real preference from an absent one.
//
// So the rail keeps its own key. The rail IS shell, and the shell is the half
// Piggles owns outright (piggles/CLAUDE.md RULE #0) — a preference about it is
// Piggles' to store. The two keys never disagree because nothing else reads this
// one, and the console simply stops consulting the shared flag for this.
//
// Deliberately three values, not a boolean: `null` means NOBODY HAS CHOSEN,
// which is the state the shared version could not express and the whole reason
// this file exists.

const KEY = 'piggles-console-rail';

/** The stored choice, or null if the person has never made one. */
export function readRailExpanded(): boolean | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === 'expanded') return true;
    if (raw === 'collapsed') return false;
    return null;
  } catch {
    // Storage blocked (private mode, embedded webview). Treated as "no
    // preference", so the person still gets the comfortable default rather than
    // an error — the setting simply will not survive the session.
    return null;
  }
}

export function writeRailExpanded(expanded: boolean): void {
  try {
    localStorage.setItem(KEY, expanded ? 'expanded' : 'collapsed');
  } catch {
    // See above — a rail that cannot remember its width is not worth breaking a
    // workspace over.
  }
}
