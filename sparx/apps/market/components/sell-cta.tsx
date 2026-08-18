// The "Sell on sparx.market" band that closes the home page (and is reusable on
// other discovery surfaces). A bold solid primary (sparx Ember) surface + a real
// photo of a small-business owner fulfilling orders, so the seller pitch lands with
// a human image rather than a flat panel. Server component; solid fills only — no
// gradient. The photo is stock (see lib/editorial), reserved for narrative.

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Store } from 'lucide-react';
import { Button } from '@wizeworks/silicaui-react';

import { Container } from '@/components/ui/layout';
import { SELL_IMAGE, SELL_ALT } from '@/lib/editorial';

export function SellCta() {
  return (
    <section className="bg-primary text-primary-content">
      <Container className="py-14 md:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="max-w-xl">
            <h2 className="text-[2rem] leading-[1.08] font-bold tracking-[-0.02em] md:text-[2.75rem]">
              Turn your shop into a marketplace storefront.
            </h2>
            <p className="text-primary-content/90 mt-5 text-[1.0625rem] leading-relaxed">
              Already running a store on sparx? List your products on the marketplace in a click and
              reach shoppers across the whole network — sparx handles payment and payout, so you
              just make and ship.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Button render={<Link href="/sell" />} color="neutral" variant="solid" size="lg">
                <Store size={18} aria-hidden />
                Start selling
              </Button>
              <Link
                href="/merchants"
                className="text-primary-content inline-flex items-center gap-1.5 text-[0.9375rem] font-semibold underline-offset-4 hover:underline"
              >
                See who’s selling
                <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
          </div>

          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl lg:aspect-[3/2]">
            <Image
              src={SELL_IMAGE}
              alt={SELL_ALT}
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
