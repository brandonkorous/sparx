// Media + text section — an image column beside a text column (eyebrow /
// heading / body / CTAs). The image side and background are configurable;
// stacks to one column on narrow screens (CSS).

import type { MediaTextConfig } from '@sparx/sitebuilder-schemas';
import { focalToPosition } from '@sparx/sitebuilder-schemas';

import { mediaUrl } from '@/lib/media';
import type { SectionContext } from '../section-renderer';
import { SbCtaRow } from './_shared';

export function MediaTextSection({
  config,
  ctx,
}: {
  config: MediaTextConfig;
  ctx: SectionContext;
}) {
  const img = mediaUrl(config.mediaId ?? null, ctx.tenantSlug);
  const position = focalToPosition(config.imageFocal);

  const grid = (
    <div
      className={config.fullBleed ? 'sf-sb-mediatext__grid' : 'sf-container sf-sb-mediatext__grid'}
      data-media-side={config.mediaSide}
    >
      <div className="sf-sb-mediatext__media">
        {img ? (
          <div
            className="sf-sb-mediatext__img"
            style={{
              backgroundImage: `url("${img}")`,
              backgroundSize: config.imageFit === 'contain' ? 'contain' : 'cover',
              backgroundPosition: position,
            }}
          />
        ) : null}
      </div>
      <div className="sf-sb-mediatext__text">
        {config.eyebrow ? <p className="sf-sb-mediatext__eyebrow">{config.eyebrow}</p> : null}
        {config.heading ? <h2 className="sf-h2">{config.heading}</h2> : null}
        {config.body ? <p className="sf-sb-mediatext__body">{config.body}</p> : null}
        <SbCtaRow ctas={config.ctas} />
      </div>
    </div>
  );

  return config.fullBleed ? (
    <section
      className="sf-section sf-section--flush sf-sb-mediatext"
      data-bg={config.background}
      data-fullbleed="true"
    >
      {grid}
    </section>
  ) : (
    <section className="sf-section sf-sb-mediatext" data-bg={config.background}>
      {grid}
    </section>
  );
}
