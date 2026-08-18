// The shared theme stylesheet for the marketplace component previews (docs/118). Kept
// in its own module (imported only by the browse + detail PAGES, server-side) so the
// client `LoadMore` island — which imports the sibling ./component-preview injector —
// never pulls the silica-catalog barrel into the client bundle.
//
// Emits EVERY theme's token set (Ember base + the 20 presets), each scoped to
// `html[data-cp-tk="<key>"] .cp-surface` (+ the dark delta under `[data-cp-mode="dark"]`),
// plus one Google-Fonts link covering every face. The picker (./component-theme-picker)
// re-themes the previews by setting `data-cp-tk` / `data-cp-mode` on `<html>` — which
// touches ONLY `.cp-surface`, never the marketing chrome. Emitted ONCE per page.

import { previewThemesCss, previewFontsHref } from '@/lib/preview-themes';

export function ComponentPreviewStyles() {
  const css = previewThemesCss();
  const fonts = previewFontsHref();
  return (
    <>
      {fonts ? <link rel="stylesheet" href={fonts} /> : null}
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </>
  );
}
