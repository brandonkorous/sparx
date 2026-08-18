import { Faq } from '../faq';
import { verticalStack } from './stack';
import { StackLedger } from './stack-ledger';
import { VerticalHero } from './vertical-hero';
import { VerticalJobs } from './vertical-jobs';
import { VerticalBlueprint } from './vertical-blueprint';
import { VerticalCta } from './vertical-cta';
import type { Vertical } from './registry';

/**
 * One industry landing page, composed.
 *
 * The band order is the argument, in the order the objections arrive: is this
 * for me (hero, with the trade names spelled out) → does it do what my week
 * needs (jobs) → what does it cost me (the price table, the flagship) → how
 * long will it take (blueprint) → the four things I would ask before signing
 * up (FAQ) → start.
 *
 * Tones alternate deliberately — dark, surface, page, surface, page, dark. Two
 * adjacent bands of the same tone merge into one long run with a couple of
 * hundred pixels of dead space in the middle, which is the failure that
 * `<Band>`'s tone axis exists to prevent. The FAQ's tone is fixed at `page`
 * (it is a shared section, not a `<Band>`), so the band before it must be
 * something else, and the band before THAT must be `page` — which is what fixes
 * the whole sequence once the hero and the close are dark.
 *
 * ## Structured data
 *
 * Three graphs, all generated from the same data the page renders:
 *   • FAQPage — emitted by `<Faq>` itself, server-side, from the same items the
 *     accordion shows. This is the text an assistant quotes when someone asks
 *     it about salon booking software, which makes it the highest-leverage
 *     markup on the page.
 *   • BreadcrumbList — these pages are ad and social landing targets, so most
 *     visitors (and crawlers) arrive with nothing above them in the history.
 *   • SoftwareApplication + Offer — the real monthly price of THIS industry's
 *     stack, computed by ./stack.ts. It is a figure we can stand behind because
 *     the page shows its working directly underneath.
 */
export function VerticalPage({ vertical }: { vertical: Vertical }) {
  const stack = verticalStack(vertical);
  const url = `https://sparx.works/for/${vertical.slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'sparx', item: 'https://sparx.works' },
          {
            '@type': 'ListItem',
            position: 2,
            name: "Who it's for",
            item: 'https://sparx.works/customers',
          },
          { '@type': 'ListItem', position: 3, name: vertical.label, item: url },
        ],
      },
      {
        '@type': 'SoftwareApplication',
        name: `sparx for ${vertical.plural}`,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url,
        description: vertical.seoDescription,
        offers: {
          '@type': 'Offer',
          price: String(stack.monthly),
          priceCurrency: 'USD',
          url: 'https://sparx.works/pricing',
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main>
        <VerticalHero vertical={vertical} />
        <VerticalJobs vertical={vertical} />
        <StackLedger vertical={vertical} />
        <VerticalBlueprint vertical={vertical} />
        <Faq
          id="faq"
          items={vertical.faq}
          heading={
            <>
              {`Before you sign up`}
              <span className="text-primary">.</span>
            </>
          }
          lede={`The four things ${vertical.plural} ask first. Anything else, there is a real person on the other end of /contact.`}
        />
        <VerticalCta vertical={vertical} />
      </main>
    </>
  );
}
