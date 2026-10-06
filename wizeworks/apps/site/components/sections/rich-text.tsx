// Rich text section — a formatted prose block. The HTML is sanitized at write
// time by the customizer's editor (docs/29 §5: config.html is "sanitized HTML
// produced by the customizer's rich-text editor"), so we render it directly;
// the storefront is a trusted consumer of its own published content.

import type { RichTextConfig } from '@wizeworks/sitebuilder-schemas';

export function RichTextSection({ config }: { config: RichTextConfig }) {
  if (!config.heading && !config.html) return null;
  const containerClass =
    config.width === 'narrow'
      ? 'mx-auto w-full max-w-[68ch] px-6'
      : 'mx-auto w-full max-w-6xl px-6';
  const alignClass =
    config.align === 'center' ? 'text-center' : config.align === 'right' ? 'text-right' : '';

  return (
    <section className={`${containerClass} py-16`}>
      <div className={alignClass}>
        {config.heading ? (
          <h2 className="text-base-content text-3xl font-semibold tracking-tight">
            {config.heading}
          </h2>
        ) : null}
        {/* config.html is sanitized at publish time (docs/29 §5). */}
        {config.html ? (
          <div
            // Lists get their markers back: the reset strips them, and a bulleted
            // list read as indented paragraphs (sparx persona issue 038).
            className="text-base-content [&_a]:text-primary [&_img]:rounded-field leading-[1.7] [&_img]:h-auto [&_img]:max-w-full [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
            dangerouslySetInnerHTML={{ __html: config.html }}
          />
        ) : null}
      </div>
    </section>
  );
}
