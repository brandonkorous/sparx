import { accountUrl, PRODUCT } from '@piggles/config';
import { PRICE_LABEL } from '@piggles/config/pricing';
import { CloseBand } from '../close-band';
import { InsteadOf } from '../instead-of';
import { TheDay } from '../the-day';
import { Thursday } from './thursday';
import { Whatever } from './whatever';
import { TheTurn } from './the-turn';
import { TwoQuestions } from './two-questions';
import { Pricing } from './pricing';
import { Questions } from './questions';

// meetpiggles.com, the home page. Order: the day, Thursday, whatever you run,
// the turn, two questions, the one price, instead of, questions, close.

// Every section lands in three to five seconds (15 to 40 words of prose) and
// points somewhere for the rest: a page of its own, a disclosure, or an optional
// interaction. The film is the exception; it is the thing being pointed at.

// Server components, deliberately: `<TheDay>` and `<Faq>` are the only client
// boundaries, which is why CTAs are anchors carrying `buttonClasses`.

// One depiction of the workspace, not two: `<TheDay>` replaced the hero cards and
// the collage, which are deleted rather than parked so nobody re-adds them.

export function HomePage() {
  return (
    // No top padding: the film is a full-bleed dark act, so page ground above it
    // reads as a seam. Its breathing room is the mat's padding (see ../the-day).
    <div className="space-y-8 pb-8 sm:space-y-14">
      <TheDay />
      <Thursday />
      <Whatever />
      <TheTurn />
      <TwoQuestions />
      <Pricing />
      <InsteadOf />
      <Questions />
      <CloseBand
        heading={`Go and run the business. ${PRODUCT.name} will handle the business software.`}
        primary={{ label: 'Get Piggles', href: accountUrl('signup', 'home-close') }}
        secondary={{ label: 'Talk to a person', href: accountUrl('contact', 'home-close') }}
        note={`${PRICE_LABEL} a month · free for 14 days · no card needed`}
      />
    </div>
  );
}
