import { Faq } from '../faq';
import { SALES_HREF } from '../cta';
import { PRICING_FAQ } from './data';

/**
 * FAQ beat — the pricing objections, rendered by the shared `<Faq>`.
 *
 * This file used to hand-roll the sticky-headline + accordion layout and emit
 * its own FAQPage JSON-LD, as a near-verbatim copy of landing's. Both are the
 * shared component now: same markup, same structured data, one place to change
 * it. What is left here is only what is genuinely page-specific — the questions,
 * the headline, and a lede that points back at the switchboard above.
 */
export function PricingFaq() {
  return (
    <Faq
      id="faq"
      items={PRICING_FAQ}
      heading={
        <>
          Questions
          <br />
          about the bill
          <span className="text-primary">.</span>
        </>
      }
      lede={
        <>
          Still curious? Read the platform docs, price your own stack above, or{' '}
          <a href={SALES_HREF} className="text-primary">
            book a 20-min call
          </a>
          . We don&rsquo;t do high-pressure demos.
        </>
      }
    />
  );
}
