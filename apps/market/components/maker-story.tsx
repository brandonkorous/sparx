// The maker-story band — a full-bleed editorial break that puts a human face on
// the marketplace. A soft warm cream wash (warning at low opacity — earthy and
// inviting, and it pairs with the clay tones of the potter photo without repeating
// the pink hero), a real photograph of an independent maker at work, and one honest
// line about buying direct. Server component; solid fills only (no gradient). The
// photo is stock (see lib/editorial) — reserved for narrative, never real inventory.

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { Button } from '@wizeworks/silicaui-react';

import { Container } from '@/components/ui/layout';
import { MAKER_IMAGE, MAKER_ALT } from '@/lib/editorial';

export function MakerStory() {
  return (
    <section className="bg-warning/10 text-base-content">
      <Container className="py-14 md:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="max-w-xl">
            <h2 className="text-[2rem] leading-[1.08] font-bold tracking-[-0.02em] md:text-[2.75rem]">
              Every order supports a real person.
            </h2>
            <p className="text-base-content mt-5 text-[1.0625rem] leading-relaxed">
              Behind every listing on sparx.market is an independent maker — a potter, a baker, a
              designer — running their own shop. Buy here and you buy direct from them, with no
              faceless middleman in between.
            </p>
            <div className="mt-8">
              <Button render={<Link href="/merchants" />} color="neutral" variant="solid" size="lg">
                Meet the sellers
                <ArrowRight size={18} aria-hidden />
              </Button>
            </div>
          </div>

          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl sm:aspect-[16/10] lg:aspect-[4/5]">
            <Image
              src={MAKER_IMAGE}
              alt={MAKER_ALT}
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
