// Which chrome wraps one page (doc 139 §5).
//
// A site's shells have always been a per-property CATALOG — `builder_layouts` holds
// many rows and exactly one carries `is_active`. What was missing was the per-page
// POINTER at them, so the storefront asked for "the frame" and wrapped every page in
// the active one. A chrome-off landing page was therefore unrepresentable: an author
// could build the page, but not stop the header and footer appearing around it.
//
// THREE STATES, and the difference between the two empty-looking ones is the feature:
//
//   undefined / null column  → the site DEFAULT (the active layout)
//   'none'                   → NO frame; the page renders bare
//   a layout id              → that layout
//
// A DANGLING id resolves to NO frame and is REPORTED, never silently swapped for the
// default. The author moved this page off the default deliberately; putting the header
// back because a shell was renamed is the worse failure, and it is the one nobody
// notices until a customer sees it.
//
// Pure and storage-free on purpose: the same resolution has to happen in the publish
// pipeline, in the public read, and in the studio's preview, and three copies of a
// tri-state rule is how they end up disagreeing about what `null` meant.

/** The sentinel meaning "this page renders bare". Not a uuid, so it can never collide
 *  with a real layout id; the column's CHECK constraint enforces that. */
export const FRAME_NONE = 'none';

/** What a page's stored `frame_id` can be. `null`/absent = the site default. */
export type StoredFrameId = string | null | undefined;

export type PageFrameChoice =
  /** No `frame_id`: whatever the site's active layout is. */
  | { kind: 'default' }
  /** Explicitly bare — a campaign or landing page. */
  | { kind: 'none' }
  /** A specific layout, which exists. */
  | { kind: 'named'; frameId: string }
  /** A specific layout that is GONE — renders bare, and says so. */
  | { kind: 'missing'; frameId: string };

/**
 * Resolve a stored `frame_id` against the layout ids that actually exist.
 *
 * `available` is the set of layout ids on this property. Pass it even when you intend
 * to ignore a missing one: distinguishing `named` from `missing` is what lets a caller
 * render bare AND tell the author why, which is the entire reason a dangling id is not
 * quietly folded into the default.
 */
export function resolvePageFrame(
  frameId: StoredFrameId,
  available: ReadonlySet<string> | readonly string[]
): PageFrameChoice {
  if (frameId == null) return { kind: 'default' };
  if (frameId === FRAME_NONE) return { kind: 'none' };
  const has = Array.isArray(available)
    ? available.includes(frameId)
    : (available as ReadonlySet<string>).has(frameId);
  return has ? { kind: 'named', frameId } : { kind: 'missing', frameId };
}

/** Jargon-free copy for a page pointing at a shell that no longer exists. Written for a
 *  non-technical owner: it says what they will SEE, not what dangled. */
export function frameMissingMessage(pageName: string): string {
  return (
    `"${pageName}" is set to use a header and footer design that has since been deleted, ` +
    `so it is currently published with none at all. Pick a design for it, or set it to ` +
    `use the site default.`
  );
}

/** The value to STORE for a choice — the inverse of `resolvePageFrame`, so a settings
 *  form round-trips without a second copy of the tri-state rule. `missing` stores the
 *  id it already had: an author who opens page settings and presses Save without
 *  touching the frame must not silently have their choice rewritten. */
export function storedFrameId(choice: PageFrameChoice): string | null {
  switch (choice.kind) {
    case 'default':
      return null;
    case 'none':
      return FRAME_NONE;
    default:
      return choice.frameId;
  }
}
