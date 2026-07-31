// The Lightbox island's static render (the SSR + canvas output): it must emit the
// thumbnail grid with its children and the recipe class, and NEVER the full-viewport
// overlay up front — the overlay is opened by a client click, so a server/canvas
// render leaks no fixed overlay. The interactive open/prev/next path is exercised in
// the Phase 5 browser acceptance (no client event harness here).

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BuilderLightbox } from './lightbox';

describe('BuilderLightbox island (static render)', () => {
  it('renders the thumbnail grid + children in both modes, overlay closed', () => {
    for (const edit of [true, false]) {
      const html = renderToStaticMarkup(
        <BuilderLightbox leafClass="grid grid-cols-3" edit={edit}>
          <img src="/a.jpg" alt="A" />
          <img src="/b.jpg" alt="B" />
        </BuilderLightbox>
      );
      expect(html).toContain('grid');
      expect(html).toContain('grid grid-cols-3');
      expect(html).toContain('/a.jpg');
      expect(html).toContain('/b.jpg');
      // The overlay only mounts after a client click.
      expect(html).not.toContain('lightbox-popup');
      expect(html).not.toContain('aria-modal');
    }
  });
});
