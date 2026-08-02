import { Badge, Heading, Text } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import type { PartnerCard } from '@/lib/partners';
import { Band } from '../band';

/**
 * The directory aside — the one block on this page addressed to someone who is
 * NOT a prospective partner, but a business looking to hire one.
 *
 * It renders REAL partners or none. The version this replaces hard-coded a
 * three-row preview of "Northlight Studio · Remote", "Certified · Austin, TX"
 * and "Registered · Portland, OR" — invented firms in invented cities, on a
 * public page, presented as the directory's actual contents. Two of the three
 * rows did not even carry a name: a tier badge sat in the name column, so the
 * fabrication also looked broken. The data layer has always been able to return
 * the real thing (`fetchPartners`), and when it returns nothing the honest
 * answer is to show nothing — the copy already works without a list.
 */
export function PartnersDirectory({ partners }: { partners: PartnerCard[] }) {
  const shown = partners.slice(0, 3);
  return (
    <Band tone="page">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col items-start gap-5">
          <Heading level={2} size="display" className="text-4xl tracking-tight sm:text-5xl">
            Looking for a partner, not a program
            <span className="text-primary">?</span>
          </Heading>
          <Text variant="lead" className="max-w-xl">
            If you run a business and want someone to set sparx up properly, the directory lists
            partners by where they are and what they specialise in. Contact them directly — they
            work for you, not for us.
          </Text>
          <a
            href="/partners/directory"
            aria-label="Find a partner"
            className={buttonClasses({ size: 'lg', color: 'primary', variant: 'solid' })}
          >
            Find a partner &rarr;
          </a>
        </div>

        {shown.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {shown.map((p) => (
              <div
                key={p.id}
                className="border-base-300 bg-base-100 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border px-5 py-4"
              >
                <span className="text-md flex items-center gap-3 font-medium">
                  {/* Same rule as the directory card: the name goes to the
                      partner's own page on sparx.works. */}
                  <a href={`/partners/${p.slug}`} className="no-underline">
                    {p.displayName}
                  </a>
                  {p.tier === 'informal' ? null : (
                    <Badge color={p.tier === 'certified' ? 'primary' : 'info'} size="sm">
                      {p.tier === 'certified' ? 'Certified' : 'Registered'}
                    </Badge>
                  )}
                </span>
                <span className="text-md">{placeOf(p)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Band>
  );
}

function placeOf(p: PartnerCard): string {
  const parts = [p.locationCity, p.locationState].filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  return p.isRemote ? 'Remote' : '';
}
