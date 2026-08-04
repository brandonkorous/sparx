// `buttonClasses` from the `/server` subpath — NOT `<Button render={<a/>}>`.
// This is a Server Component: an element passed as `render` crosses the
// Server→Client boundary and arrives as a lazy client reference, so its `.type`
// is undefined and silica's `cloneElement(render, …)` throws "Element type is
// invalid… got: undefined" (its `theirs = {}` guard only covers `.props`, and
// would silently drop `href` anyway). The class builders are React-free; import
// them from `/server` because the package ROOT is a 'use client' bundle.
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Container, Display, Spark, Text } from '../primitives';
import { CopyValue } from './interactive';
import { OfficialWordmark } from './assets';

/** Section anchors surfaced as the "on this page" index. Ids match each
 *  <Section id> below the hero so the chips deep-link cleanly. */
export const BRAND_SECTIONS = [
  { id: 'wordmark', label: 'Wordmark' },
  { id: 'monogram', label: 'The mark' },
  { id: 'mascot', label: 'Sparky' },
  { id: 'misuse', label: 'Misuse' },
  { id: 'color', label: 'Primary color' },
  { id: 'modules', label: 'Module colors' },
  { id: 'palette', label: 'Palette' },
  { id: 'type', label: 'Typography' },
  { id: 'principles', label: 'Principles' },
  { id: 'voice', label: 'Voice & tone' },
  { id: 'not', label: "What we're not" },
  { id: 'downloads', label: 'Assets' },
] as const;

const IDENTITY: { label: string; value: string }[] = [
  { label: 'Platform', value: 'sparx' },
  { label: 'Company', value: 'WizeWorks LLC' },
  { label: 'Primary domain', value: 'sparx.works' },
  { label: 'Maintained by', value: 'brand@sparx.works' },
];

export function BrandHero() {
  return (
    <section className="px-page bg-base-200 border-base-300 border-b pt-[clamp(104px,13vw,168px)] pb-28">
      <Container className="flex flex-col gap-10">
        <OfficialWordmark className="w-[clamp(208px,32vw,332px)]" />

        <div className="flex max-w-[880px] flex-col gap-6">
          <Display as="h1" size={84} lineHeight={80}>
            The system behind the spark
            <Spark />
          </Display>
          <Text size={19} className="max-w-[660px]">
            The wordmark, the color system, the Geist type scale, and the voice that keep sparx
            coherent across twelve modules, a dozen domains, and every surface a tenant touches.
            This page is the source of truth — for us, and for anyone building with the sparx brand.
          </Text>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a href="#downloads" className={buttonClasses({ color: 'primary', size: 'lg' })}>
            Download brand assets
          </a>
          <a href="mailto:brand@sparx.works">
            <Text as="span" mono size={13} className="py-3 no-underline">
              Press kit → brand@sparx.works
            </Text>
          </a>
        </div>

        <IdentityList />

        <SectionIndex />

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <Text as="span" size={13}>
            Tap any swatch, hex, or token to copy it.
          </Text>
          <CopyValue value="#e04631" label="Copy the sparx Ember hex" />
        </div>
      </Container>
    </section>
  );
}

function IdentityList() {
  return (
    <dl className="border-base-300 mt-2 grid grid-cols-1 gap-5 border-t pt-2 sm:grid-cols-2 lg:grid-cols-4">
      {IDENTITY.map((row) => (
        <div key={row.label} className="flex flex-col gap-1.5 pt-6">
          <Text as="dt" size={12.5}>
            {row.label}
          </Text>
          <Text as="dd" size={15} weight={500}>
            {row.value}
          </Text>
        </div>
      ))}
    </dl>
  );
}

function SectionIndex() {
  return (
    <nav aria-label="On this page" className="flex flex-wrap items-center gap-2 pt-1">
      {BRAND_SECTIONS.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={buttonClasses({ color: 'neutral', variant: 'outline', size: 'sm' })}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}
