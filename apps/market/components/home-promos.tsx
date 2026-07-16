// The promo strip — three curated "edits" that deep-link into filtered catalog
// views (best sellers, newest, budget). Each is a real destination on the PLP, not
// a decorative banner. The representative photo is pulled from the live catalog
// slice it links to, so the promo always shows something actually shoppable. Each
// edit carries its own hue by function (not decoration) via its icon.

import Image from 'next/image';
import { ImageOff, type LucideIcon } from 'lucide-react';

import { LinkCard } from '@/components/ui/card';
import { hueText } from '@/lib/hue';

export interface PromoCardData {
  label: string;
  sub: string;
  href: string;
  imageUrl: string | null;
  icon: LucideIcon;
  /** A token color name (`warning` | `info` | `success` | …) for the icon accent. */
  color: string;
}

function PromoCard({ promo }: { promo: PromoCardData }) {
  const Icon = promo.icon;
  return (
    <LinkCard href={promo.href} ariaLabel={promo.label} className="rounded-2xl">
      <div className="bg-base-200 relative aspect-[16/10] overflow-hidden">
        {promo.imageUrl ? (
          <Image
            src={promo.imageUrl}
            alt={promo.label}
            fill
            sizes="(min-width: 768px) 33vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <span
            className="text-base-content flex h-full w-full items-center justify-center"
            aria-hidden
          >
            <ImageOff size={28} />
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2">
          <Icon size={18} aria-hidden className={hueText(promo.color)} />
          <span className="text-base-content text-lg font-semibold">{promo.label}</span>
        </div>
        <span className="text-base-content mt-1 block text-[0.875rem]">{promo.sub}</span>
      </div>
    </LinkCard>
  );
}

export function PromoStrip({ promos }: { promos: PromoCardData[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
      {promos.map((promo) => (
        <PromoCard key={promo.href} promo={promo} />
      ))}
    </div>
  );
}
