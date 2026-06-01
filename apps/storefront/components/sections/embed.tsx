// Embed section — a responsive, sandboxed third-party iframe (map, video,
// booking widget, …) built from a single pasted URL. The provider normalization
// lives in @sparx/sitebuilder-schemas (resolveEmbed) so the editor preview and
// the storefront agree. Renders nothing for an empty / unusable URL.

import type { EmbedConfig } from '@sparx/sitebuilder-schemas';
import { resolveEmbed } from '@sparx/sitebuilder-schemas';

export function EmbedSection({ config }: { config: EmbedConfig }) {
  const resolved = resolveEmbed(config.url);
  if (!resolved) return null;

  const full = config.width === 'full';
  return (
    <section className="sf-section sf-sb-embed" data-width={config.width}>
      <div className={full ? 'sf-sb-embed__bleed' : 'sf-container'}>
        {config.heading ? <h2 className="sf-h2 sf-sb-embed__heading">{config.heading}</h2> : null}
        <div className="sf-sb-embed__frame" data-aspect={config.aspect}>
          <iframe
            src={resolved.src}
            title={config.heading || resolved.title}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
            allow="fullscreen; encrypted-media; picture-in-picture; geolocation"
            allowFullScreen={resolved.allowFullScreen}
          />
        </div>
        {config.caption ? <p className="sf-muted sf-sb-embed__caption">{config.caption}</p> : null}
      </div>
    </section>
  );
}
