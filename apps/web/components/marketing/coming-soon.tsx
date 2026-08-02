import { Button } from '@wizeworks/silicaui-react';
import { Display, Spark } from './primitives';

/**
 * Placeholder page for marketing surfaces that exist as routes but don't have
 * real content yet (e.g. /press, /careers, /legal/*). Renders an editorial
 * hero, the page title with a spark, a short description, and a CTA back to
 * the home page. Pair with `robots: { index: false }` in the route metadata
 * so search engines don't surface these stubs.
 */
export function ComingSoon({
  title,
  description,
  contact,
}: {
  /**
   * @deprecated Eyebrows are banned brand-wide (no label sits above a heading to
   * introduce it). Still accepted so the ~dozen stub routes passing it keep
   * compiling, but the value is IGNORED — same treatment `SectionHeader` gives
   * its own `eyebrow`. Drop the prop from callers when they're next touched.
   */
  eyebrow?: string;
  /** Page name — gets the spark accent. */
  title: string;
  /** One-sentence description of what this page will eventually hold. */
  description: string;
  /** Optional contact email shown below the CTA. */
  contact?: string;
}) {
  return (
    <section className="bg-base-200 px-page flex min-h-[calc(100vh-80px)] items-center py-[clamp(96px,12vw,160px)]">
      <div className="max-w-content mx-auto flex w-full flex-col items-start gap-8">
        {/* The "Coming soon" EyebrowBadge and the uppercase `eyebrow` label that
            both sat above this headline are gone — a badge in the eyebrow slot is
            the same anti-pattern wearing a component. The title carries itself. */}
        <Display as="h1" size={88} lineHeight={84}>
          {title}
          <Spark />
        </Display>

        <p className="m-0 max-w-[640px] text-lg">{description}</p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <a href="/">
            <Button color="neutral" size="lg">
              ← Back to sparx.works
            </Button>
          </a>
          {contact ? (
            <a href={`mailto:${contact}`} className="py-3 font-mono text-sm no-underline">
              Or email {contact}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
