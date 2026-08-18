// Embed section — a responsive, sandboxed third-party iframe (map, video,
// booking widget, …) built from a single pasted URL. The provider normalization
// lives in @wizeworks/sitebuilder-schemas (resolveEmbed) so the editor preview and
// the storefront agree. Renders nothing for an empty / unusable URL.

import type { EmbedConfig } from '@wizeworks/sitebuilder-schemas';
import { resolveEmbed } from '@wizeworks/sitebuilder-schemas';

// Aspect-ratio box keeps the iframe from shifting layout while it loads.
const ASPECT: Record<string, string> = {
  '16:9': 'aspect-[16/9]',
  '4:3': 'aspect-[4/3]',
  '3:2': 'aspect-[3/2]',
  '1:1': 'aspect-[1/1]',
  '21:9': 'aspect-[21/9]',
};

export function EmbedSection({ config }: { config: EmbedConfig }) {
  const resolved = resolveEmbed(config.url);
  if (!resolved) return null;

  const full = config.width === 'full';
  const innerCls = full
    ? 'w-full'
    : config.width === 'prose'
      ? 'mx-auto w-full max-w-[68ch] px-6'
      : 'mx-auto w-full max-w-6xl px-6';
  return (
    <section className="py-[clamp(2rem,5vw,4rem)]">
      <div className={innerCls}>
        {config.heading ? (
          <h2 className="text-base-content mb-4 text-3xl font-semibold tracking-tight">
            {config.heading}
          </h2>
        ) : null}
        <div
          className={`bg-base-200 relative w-full overflow-hidden ${ASPECT[config.aspect] ?? ''} ${
            full ? 'rounded-none' : 'rounded-box border-base-300 border'
          }`}
        >
          <iframe
            className="absolute inset-0 h-full w-full border-0"
            src={resolved.src}
            title={config.heading || resolved.title}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
            allow="fullscreen; encrypted-media; picture-in-picture; geolocation"
            allowFullScreen={resolved.allowFullScreen}
          />
        </div>
        {config.caption ? (
          <p className="text-base-content mt-3 text-[0.9rem]">{config.caption}</p>
        ) : null}
      </div>
    </section>
  );
}
