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
    <Link href={`/category/${category.handle}`} className="st-card">
      <div className="st-card__media">
        {category.featured ? <span className="st-badge">Featured</span> : null}
        {hero ? (
          <Image
            src={hero}
            alt={category.name}
            fill
            sizes="(max-width: 860px) 50vw, 33vw"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div className="st-card__media st-card__media--empty" aria-hidden="true">
            <span style={{ fontSize: '2rem' }}>▤</span>
          </div>
        )}
      </div>
      <div className="st-card__body">
        <span className="st-card__title">{category.name}</span>
        {category.description ? <span className="st-muted">{category.description}</span> : null}
      </div>
    </Link>
  );
}
