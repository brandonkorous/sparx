// Bound collection section — hero image + name + description for the collection.

import Image from 'next/image';

import type { CollectionHeaderConfig } from '@sparx/sitebuilder-schemas';

import { mediaUrl } from '@/lib/media';
import type { SectionContext } from '../section-renderer';

export function CollectionHeaderSection({
  config,
  ctx,
}: {
  config: CollectionHeaderConfig;
  ctx: SectionContext;
}) {
  const collection = ctx.collection;
  if (!collection) return null;
  const hero = config.showHeroImage ? mediaUrl(collection.heroMediaId, ctx.tenantSlug) : null;
  return (
    <header className={`rounded-box relative mb-8 overflow-hidden ${hero ? '' : 'bg-base-200'}`}>
      {hero ? (
        <Image
          src={hero}
          alt=""
          aria-hidden="true"
          width={1280}
          height={260}
          priority
          sizes="100vw"
          className="block h-[260px] w-full object-cover"
        />
      ) : null}
      {/* Over a hero photo the text sits in a bottom-up legibility scrim; without
          one it's an ordinary padded band. */}
      <div
        className={
          hero
            ? 'absolute inset-x-0 bottom-0 bg-linear-to-b from-transparent to-black/60 p-8 text-white'
            : 'py-10'
        }
      >
        <h1
          className={`text-4xl font-semibold tracking-tight ${hero ? 'text-white' : 'text-base-content'}`}
        >
          {collection.name}
        </h1>
        {config.showDescription && collection.description ? (
          <p className="mt-2 max-w-[60ch] leading-relaxed">{collection.description}</p>
        ) : null}
      </div>
    </header>
  );
}
