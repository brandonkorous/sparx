// Rich text section — a formatted prose block. The HTML is sanitized at write
// time by the customizer's editor (docs/29 §5: config.html is "sanitized HTML
// produced by the customizer's rich-text editor"), so we render it directly;
// the storefront is a trusted consumer of its own published content.

import type { RichTextConfig } from '@sparx/sitebuilder-schemas';

export function RichTextSection({ config }: { config: RichTextConfig }) {
  if (!config.heading && !config.html) return null;
  const containerClass =
    config.width === 'narrow' ? 'st-container st-container--prose' : 'st-container';

  return (
    <section className={`${containerClass} st-section`}>
      <div className="st-sb-richtext" data-align={config.align}>
        {config.heading ? <h2 className="st-h2">{config.heading}</h2> : null}
        {/* config.html is sanitized at publish time (docs/29 §5). */}
        {config.html ? (
          <div className="st-prose" dangerouslySetInnerHTML={{ __html: config.html }} />
        ) : null}
      </div>
    </section>
  );
}
