// Stats section — an optional full-width lead image (e.g. a map), a heading /
// subcopy with up to two CTAs, and a row of big figure + label stats.

import type { StatsConfig } from '@sparx/sitebuilder-schemas';

import { mediaUrl } from '@/lib/media';
import type { SectionContext } from '../section-renderer';
import { SbCtaRow } from './_shared';
import { StatValue } from './stat-count';

export function StatsSection({ config, ctx }: { config: StatsConfig; ctx: SectionContext }) {
  const img = mediaUrl(config.mediaId ?? null, ctx.tenantSlug);
  const items = config.items ?? [];
  const hasLead = Boolean(config.heading || config.subheading || (config.ctas ?? []).length);

  return (
    <section className="sf-section sf-sb-stats">
      {img ? (
        <div className="sf-sb-stats__media" style={{ backgroundImage: `url("${img}")` }} />
      ) : null}
      <div className="sf-container sf-sb-stats__body">
        {hasLead ? (
          <div className="sf-sb-stats__lead">
            {config.heading ? <h2 className="sf-h2">{config.heading}</h2> : null}
            {config.subheading ? <p className="sf-muted">{config.subheading}</p> : null}
            <SbCtaRow ctas={config.ctas} />
          </div>
        ) : null}
        {items.length ? (
          <div className="sf-sb-stats__grid" data-cols={config.columns}>
            {items.map((s, i) => (
              <div key={i} className="sf-sb-stat">
                <StatValue value={s.value} animate={config.animate} />
                <span className="sf-sb-stat__label">{s.label}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
