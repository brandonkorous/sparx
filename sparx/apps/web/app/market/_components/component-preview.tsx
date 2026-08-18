// Live marketplace COMPONENT preview (docs/118) — the CLIENT-safe injector half. A
// component listing is a sparx silica SECTION; instead of a baked screenshot it shows
// the real section rendered against neutral sample data. The RENDER happens server-side
// in lib/marketplace.ts (so the silica renderer + resolver never reach the client
// bundle) — this component only PROJECTS the resulting HTML string onto the shared
// `.cp-surface` base-theme surface, whose stylesheet <ComponentPreviewStyles> emits once
// per page (see ./component-preview-styles — kept in a separate module so importing THIS
// one from the client `LoadMore` island pulls in no theme/catalog code).

export interface ComponentPreviewProps {
  name: string;
  /** The server-rendered section HTML (from lib/marketplace.ts). */
  html: string;
  /** 'card' = fill + clip the browse box, forced light for a consistent grid;
   *  'detail' = the full section in its own framed, theme-aware surface. */
  variant: 'card' | 'detail';
}

/** A neutral placeholder for a legacy row with no rendered preview. */
export function PreviewPlaceholder() {
  return <div className="bg-base-200 border-base-300 aspect-[16/10] w-full rounded-xl border" />;
}

export function ComponentPreview({ name, html, variant }: ComponentPreviewProps) {
  const surface = (
    <div
      // `min-h-full` on a card so a SHORT section still fills the fixed preview box with
      // the themed surface (else the box's own bg shows below it, jarring in dark mode).
      className={`cp-surface bg-base-100 w-full ${variant === 'card' ? 'min-h-full' : ''}`}
      aria-label={`${name} preview`}
      // Theme + light/dark come from `data-cp-tk` / `data-cp-mode` on <html> (the theme
      // picker); the scoped stylesheet defaults `.cp-surface` to Ember light before the
      // picker mounts, so there's no unstyled flash.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );

  return variant === 'card' ? (
    // Fill + clip the card's fixed preview box, top-aligned so the section's heading
    // is what shows (the box provides the border; no nested frame).
    <div className="w-full self-stretch overflow-hidden">{surface}</div>
  ) : (
    <div className="border-base-300 w-full overflow-hidden rounded-xl border">{surface}</div>
  );
}
