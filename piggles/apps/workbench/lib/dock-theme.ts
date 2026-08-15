import type { DockviewTheme } from 'dockview';

// The Piggles dock: windows on a desk, not documents in a folder.
//
// ── WHY THIS IS AN OBJECT AND NOT A STYLESHEET ──────────────────────────────
//
// The gap between groups was attempted three times in CSS — `inset` on the
// group, padding on its slot, then margin plus a `calc()` height — and all three
// were wrong in the same way. `DockviewTheme.gap` is read by dockview's LAYOUT
// ENGINE, which sizes and positions every group and derives the drop targets,
// sash hit-areas and drag previews from those rectangles.
//
// A gap painted in CSS afterwards moves the pixels and not the geometry. Even
// the attempt that would have LOOKED right was a bug waiting to be reported:
// drop zones, splitter grabs and drag previews would all still have been
// computed against the old, gapless rectangle. The library has to be told, not
// styled — and it has a documented option for exactly this.
//
// The lesson is worth more than the fix: three rounds of guessing at a
// third-party's DOM, when the answer was a typed option in its own .d.ts.
//
// ── WHAT THE CLASS NAME IS FOR ──────────────────────────────────────────────
//
// dockview puts `className` on its root, alongside its own `dv-dockview`. That
// gives Piggles a scope for its `--dv-*` overrides — and it has to be a scope
// rather than a bare re-declaration, because the shared `lib/dock/dock-theme.css`
// is imported from a COMPONENT (dock.tsx) and Next injects component CSS after
// the global stylesheet. At equal specificity the shared file therefore wins.
// The console's rules answer to `.dv-dockview.piggles-dock`, two classes, which
// beats it regardless of injection order. See app/globals.css.
export const PIGGLES_DOCK_THEME: DockviewTheme = {
  name: 'piggles',
  className: 'piggles-dock',
  /** 10px between groups. Small enough to stay one workspace, large enough that
   *  two panes read as two objects rather than one with a line through it. */
  gap: 10,
  /** The drag overlay is mounted on the GROUP rather than the dock root, so the
   *  preview lands inside the window you are aiming at. With real gaps between
   *  windows an absolute overlay reads as floating in the gutter, pointing at
   *  nothing in particular. */
  dndOverlayMounting: 'relative',
  /** Dropping targets the whole window, title bar included — which is what a
   *  window-shaped group looks like it should accept. */
  dndPanelOverlay: 'group',
};
