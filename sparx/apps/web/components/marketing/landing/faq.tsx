import { Faq } from '../faq';

/**
 * FAQ beat — the shared `<Faq>` on its default question set.
 *
 * This file used to carry its own copy of those seven questions AND its own copy
 * of the sticky-headline + accordion layout, which is how the two drifted: the
 * shared set still answered the email question with "Postal on sparx.email"
 * months after Postal was decommissioned, while this copy said Mailgun. One list
 * now, in components/marketing/faq.tsx, feeding both the visible accordion and
 * the FAQPage JSON-LD — so the homepage and the structured data cannot disagree
 * with each other or with the module pages again.
 *
 * Nothing here is page-specific, so nothing is passed. The heading, lede and
 * items are all the component's defaults, which is exactly what the homepage
 * wants.
 */
export function LandingFaq() {
  return <Faq id="faq" />;
}
