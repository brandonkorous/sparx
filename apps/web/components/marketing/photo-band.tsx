import type { ReactNode } from 'react';
import { Section, SectionHeader } from './primitives';

/**
 * A marketing section whose left or right half is a PHOTOGRAPH.
 *
 * The marketing site was built entirely from type, colour and rendered device
 * mockups — no photography anywhere. That is a real gap, not a stylistic
 * position: a visitor scanning a page reads the pictures long before the prose,
 * and a page with none asks them to read their way to the point.
 *
 * This is the shared shape so photography arrives as a SYSTEM rather than as a
 * one-off `<img>` on whichever page someone happened to be editing. Change the
 * aspect ratio, the radius, or the column split here and every photo section on
 * the site follows (RULE #1).
 *
 * The image is NOT decorative, so it carries a real `alt`. It depicts the work
 * the section is describing — a stylist with a client, a counter handover — and
 * a screen-reader user should get that scene, not silence.
 *
 * Licence and provenance for every file: apps/web/public/scenes/README.md. The
 * one binding term is that a depicted person must never appear to endorse the
 * product, so these illustrate a KIND OF WORK and are never captioned as a sparx
 * customer, quoted, or named.
 */
export function PhotoBand({
  id,
  headline,
  lede,
  accent,
  src,
  alt,
  /** Which side the photograph sits on. Alternate it down a page so two photo
   *  sections never stack into the same silhouette. */
  side = 'right',
  surface = 'page',
  children,
}: {
  id?: string;
  headline: ReactNode;
  lede?: ReactNode;
  /** Section identity — the closing spark's ink class, same as SectionHeader. */
  accent?: string;
  src: string;
  alt: string;
  side?: 'left' | 'right';
  surface?: 'page' | 'surface' | 'dark' | 'primary' | 'neutral' | 'accent';
  /** Optional supporting content under the copy — a list, badges, a link. */
  children?: ReactNode;
}) {
  return (
    <Section id={id} surface={surface} padding="lg">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {/* `order` rather than two markup branches, so the copy always precedes
            the photo in the DOM — reading order stays copy-then-image no matter
            which side the picture is on visually. */}
        <div className={side === 'left' ? 'lg:order-2' : ''}>
          <SectionHeader accent={accent} headline={headline} lede={lede} />
          {children ? <div className="mt-8">{children}</div> : null}
        </div>
        <div className={side === 'left' ? 'lg:order-1' : ''}>
          {/* 4:3, matching how these are fetched, so the box is reserved before
              the file lands and the section never reflows around it. `rounded-2xl`
              + `object-cover` lets one shared shape hold photographs of any
              incoming dimensions. */}
          <img
            src={src}
            alt={alt}
            width={800}
            height={600}
            loading="lazy"
            decoding="async"
            className="aspect-[4/3] w-full rounded-2xl object-cover"
          />
        </div>
      </div>
    </Section>
  );
}
