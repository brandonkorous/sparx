import type { Metadata } from 'next';
import { FaqSection } from '@piggles/ui';
import { accountUrl, APP_COUNT_WORD_CAP, PRODUCT } from '@piggles/config';
import { fetchFounderOffer, PRICE_LABEL } from '@piggles/config/pricing';
import { CloseBand } from '@/components/marketing/close-band';
import { FounderBand } from '@/components/marketing/founder-band';
import { FRONTROW_QUESTIONS } from '@/components/marketing/frontrow/questions';
import { WhatItDoes } from '@/components/marketing/frontrow/what-it-does';
import { InsteadOf } from '@/components/marketing/instead-of';
import { TheDay, type DayIntro } from '@/components/marketing/the-day';

// /frontrow: where the QR code on the shirt lands. It opens on the shirt's own
// words, so the visitor knows they found the same Piggles. Every signup link
// carries `frontrow-`, which the account app credits to the campaign.

export const metadata: Metadata = {
  title: 'You found Piggles',
  description: 'Business software for people who have a business to run.',
  // A campaign page: shared by QR code, not something search should rank.
  robots: { index: false, follow: true },
};

const INTRO: DayIntro = {
  heading: 'Business software for people who have a business to run.',
  lede: `You found ${PRODUCT.name}. ${APP_COUNT_WORD_CAP} apps on one login: your website, selling, bookings, invoices, customers and your numbers. Here is an ordinary Thursday with it.`,
  from: 'frontrow-hero',
  secondary: { label: 'See what Piggles does', href: '#what-it-does' },
  assurances: ['Free for 14 days', 'No card needed', `${PRICE_LABEL} a month, every app included`],
};

export default async function FrontRowPage() {
  const offer = await fetchFounderOffer();
  return (
    <div className="space-y-8 pb-8 sm:space-y-14">
      <TheDay intro={INTRO} />
      <WhatItDoes />
      <FounderBand offer={offer} from="frontrow" />
      <InsteadOf />
      <FaqSection heading="What people ask first." items={FRONTROW_QUESTIONS} />
      <CloseBand
        heading="You found it. Now go and run the business."
        primary={{ label: 'Start free', href: accountUrl('signup', 'frontrow-close') }}
        secondary={{ label: 'Talk to a person', href: accountUrl('contact', 'frontrow-close') }}
        note={`${PRICE_LABEL} a month · free for 14 days · no card needed`}
      />
    </div>
  );
}
