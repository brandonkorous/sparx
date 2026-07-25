// A single category tile — the shared cell for the /category index and a detail
// page's subcategory strip. Prefers the hero image, falls back to the icon, then
// a neutral glyph. Mirrors the collection card so browse surfaces feel identical.

import Image from 'next/image';
import Link from 'next/link';

import type { PublicCategoryNode } from '@/lib/commerce';
import { mediaUrl } from '@/lib/media';

export function CategoryCard({
  category,
  tenantSlug,
}: {
  category: PublicCategoryNode;
  tenantSlug: string;
}) {
  const hero = mediaUrl(category.heroMediaId ?? category.iconMediaId, tenantSlug);
  return (
    <Link
      href={`/category/${category.handle}`}
      className="group rounded-box bg-base-100 text-base-content focus-visible:outline-primary relative flex flex-col overflow-hidden no-underline transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <div className="bg-base-200 relative aspect-square overflow-hidden">
        {category.featured ? (
          <span className="badge badge-neutral absolute top-3 left-3 z-10">Featured</span>
        ) : null}
        {hero ? (
          <Image
            src={hero}
            alt={category.name}
            fill
            sizes="(max-width: 860px) 50vw, 33vw"
            className="object-cover transition-transform duration-[400ms] group-hover:scale-105"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div
            className="bg-base-200 text-base-content/40 grid h-full place-items-center text-[2rem]"
            aria-hidden="true"
          >
            ▤
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 px-1 pt-4 pb-2">
        <span className="text-base-content text-base leading-snug font-medium">
          {category.name}
        </span>
        {category.description ? (
          <span className="text-base-content text-sm">{category.description}</span>
        ) : null}
      </div>
    </Link>
  );
}
