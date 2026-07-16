// The "shop by mood" band — three editorial lifestyle tiles that offer a softer,
// more emotional way into the catalog than the category grid (which is utilitarian,
// count-first). Each tile is a real photograph with a floating solid label (an
// opacity-tinted base-100 panel — NOT a gradient scrim) so the copy stays legible
// over any image, and deep-links into an always-resolvable catalog view. Server
// component; the photos are stock (see lib/editorial), reserved for narrative.

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

import { Container } from '@/components/ui/layout';
import { SectionHeading } from '@/components/home-sections';
import { LIFESTYLE_EDITS, type LifestyleEdit } from '@/lib/editorial';

function LifestyleTile({ edit, priority }: { edit: LifestyleEdit; priority: boolean }) {
  return (
    <Link
      href={edit.href}
      aria-label={edit.title}
      className="group bg-base-300 relative block aspect-[3/4] overflow-hidden rounded-2xl"
    >
      <Image
        src={edit.image}
        alt={edit.alt}
        fill
        priority={priority}
        sizes="(min-width: 768px) 33vw, 100vw"
        className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
      />
      <div className="bg-base-100/95 absolute inset-x-3 bottom-3 rounded-xl p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-base-content text-lg font-semibold">{edit.title}</span>
          <ArrowRight
            size={18}
            aria-hidden
            className="text-primary shrink-0 transition-transform group-hover:translate-x-0.5"
          />
        </div>
        <span className="text-base-content mt-0.5 block text-sm">{edit.sub}</span>
      </div>
    </Link>
  );
}

export function LifestyleTrio() {
  return (
    <section className="bg-base-200">
      <Container className="py-14 md:py-20">
        <SectionHeading
          title="Find your corner of the marketplace"
          sub="Ways in for however you like to shop — from the workshop to the pantry."
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {LIFESTYLE_EDITS.map((edit, i) => (
            <LifestyleTile key={edit.href} edit={edit} priority={i === 0} />
          ))}
        </div>
      </Container>
    </section>
  );
}
