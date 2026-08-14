import Image from 'next/image';

// A section that is half picture, half argument.
//
// Photography arrives through THIS rather than a loose <img> on whichever page
// someone was editing, so the aspect ratio, the radius and the column split
// change in one place. Every photo in public/photos is 1600×1067 (3:2) and this
// assumes it — a mixed set makes the section ragged.
//
// `side` alternates down the page. That alternation is the only thing stopping a
// run of these from reading like a template, so vary it.

export interface PhotoBandProps {
  src: string;
  alt: string;
  /** Which side the picture sits on at desktop width. Stacks picture-first on
   *  mobile either way — a wall of text with the image below it is what a phone
   *  reader scrolls straight past. */
  side?: 'left' | 'right';
  children: React.ReactNode;
  /** Surface the band sits on, so consecutive sections can alternate. */
  className?: string;
}

export function PhotoBand({ src, alt, side = 'right', children, className = '' }: PhotoBandProps) {
  return (
    <section className={`px-6 py-20 sm:py-28 ${className}`}>
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div
          className={
            side === 'left'
              ? 'rounded-box border-base-300 overflow-hidden border lg:order-1'
              : 'rounded-box border-base-300 overflow-hidden border lg:order-2'
          }
        >
          <Image
            src={src}
            alt={alt}
            width={1600}
            height={1067}
            className="h-full w-full object-cover"
            sizes="(max-width: 1024px) 100vw, 512px"
          />
        </div>
        <div className={side === 'left' ? 'lg:order-2' : 'lg:order-1'}>{children}</div>
      </div>
    </section>
  );
}

/** A strip of small photographs — breadth rather than a single scene.
 *
 *  Used once, for the "whatever kind of business" claim: eight trades in one
 *  glance argues the point faster than a sentence can, which is the test for
 *  whether a picture earned its place.
 *
 *  Two and four columns, never three: the set is eight, and a three-column grid
 *  leaves a two-item orphan row that reads as a photograph missing rather than a
 *  grid ending. */
export function PhotoStrip({
  photos,
  className = '',
}: {
  photos: { src: string; alt: string; label: string }[];
  className?: string;
}) {
  return (
    <ul className={`grid grid-cols-2 gap-3 lg:grid-cols-4 ${className}`}>
      {photos.map((p) => (
        <li key={p.src} className="rounded-box border-base-300 overflow-hidden border">
          <figure>
            <Image
              src={p.src}
              alt={p.alt}
              width={1600}
              height={1067}
              className="aspect-[3/2] w-full object-cover"
              sizes="(max-width: 640px) 50vw, 280px"
            />
            <figcaption className="bg-base-100 px-3 py-2 text-base font-semibold">
              {p.label}
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}
