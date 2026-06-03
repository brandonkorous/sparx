// Panels section — a row of 1–4 self-contained panels. Two variants:
//  • media: a full-bleed photo card with overlaid eyebrow/heading/copy/CTAs at a
//    configurable anchor (the recurring 2-up "feature card row").
//  • card:  a light surface card — image on top, content below.
// Stacks to one column on narrow screens (CSS).

import type { PanelsConfig } from '@sparx/sitebuilder-schemas';
import { focalToPosition } from '@sparx/sitebuilder-schemas';

import { mediaUrl } from '@/lib/media';
import type { SectionContext } from '../section-renderer';
import { SbCtaRow } from './_shared';

export function PanelsSection({ config, ctx }: { config: PanelsConfig; ctx: SectionContext }) {
  const items = config.items ?? [];
  if (items.length === 0) return null;
  const overlay = Math.min(100, Math.max(0, config.overlayOpacity)) / 100;
  const isMedia = config.variant === 'media';

  return (
    <section className="sf-container sf-section">
      {config.heading ? (
        <div className="sf-section__head">
          <h2 className="sf-h2">{config.heading}</h2>
        </div>
      ) : null}
      <div className="sf-sb-panels" data-cols={config.columns} data-variant={config.variant}>
        {items.map((p, i) => {
          const img = mediaUrl(p.mediaId ?? null, ctx.tenantSlug);
          const bg = img
            ? {
                backgroundImage: `url("${img}")`,
                backgroundSize: p.imageFit === 'contain' ? 'contain' : 'cover',
                backgroundPosition: focalToPosition(p.imageFocal),
              }
            : undefined;
          const content = (
            <div className="sf-sb-panel__inner">
              {p.eyebrow ? <p className="sf-sb-panel__eyebrow">{p.eyebrow}</p> : null}
              {p.heading ? <h3 className="sf-sb-panel__title">{p.heading}</h3> : null}
              {p.subheading ? <p className="sf-sb-panel__sub">{p.subheading}</p> : null}
              <SbCtaRow ctas={p.ctas} />
            </div>
          );

          if (isMedia) {
            return (
              <div
                key={i}
                className="sf-sb-panel sf-sb-panel--media"
                data-align={config.align}
                data-valign={config.verticalAlign}
                data-height={config.height}
                data-text={config.textColor}
                style={bg}
              >
                {img ? (
                  <div
                    className="sf-sb-panel__scrim"
                    style={{ opacity: overlay }}
                    aria-hidden="true"
                  />
                ) : null}
                {content}
              </div>
            );
          }

          return (
            <div key={i} className="sf-sb-panel sf-sb-panel--card">
              {img ? <div className="sf-sb-panel__media" style={bg} /> : null}
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
