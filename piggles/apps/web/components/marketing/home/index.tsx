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

// meetpiggles.com — the home page.
//
// ── THE SHAPE ───────────────────────────────────────────────────────────────
//
//   1  The day        — one app window, pinned, with a Thursday running through it
//   1b Thursday    — and here is the Thursday night you actually had
//   2  Whatever        — whatever kind of business you have
//   3  The turn       — stop typing the same thing three times
//   4  The sixth place — one fact, six copies, and the fifteen that share one
//   5  Two questions  — what actually happens when you sign up
//   6  the one price  — what your time is worth, then the one price
//   7  Instead of     — the ten bills this replaces, against the one
//   8  Questions      — the six people ask before signing anything
//   9  Close
//
// ── THE CONTRACT EVERY SECTION ON THIS PAGE IS HELD TO ──────────────────────
//
// **A section lands in three to five seconds, and points somewhere for the rest.**
// The film is the only exception — it is the thing being pointed at.
//
// Three to five seconds is roughly 15–40 words of PROSE. Names in a grid, trade
// captions on a wall and answers inside a closed accordion do not count against
// it, because those are scanned rather than read. What counts is the sentences a
// person has to take in sequence before the section means anything.
//
// This was measured on the live page and half of it failed. The turn was 146
// words, the bento 268, onboarding 202, price 192, trust 198 — and separately,
// the five sections that WERE short enough (Thursday night, the trade wall,
// onboarding, the questions, the close) linked to nothing at all. So every
// section was breaking one half of the rule or the other, and none was doing
// both. Sections were being written as arguments when the page needs signposts.
//
// The three legal homes for depth, in order of preference:
//
//   1. **A page of its own.** /apps, /pricing, /trust, /how-it-works,
//      /who-its-for. Two of those were built for this pass, because the sections
//      that had to be cut had nowhere to send anybody.
//   2. **A disclosure.** The FAQ passes at 80 words because six answers are
//      folded away until asked for.
//   3. **An optional interaction.** Something a reader can spend a minute on
//      while the section still lands in three seconds for somebody who ignores
//      it. The price section held one — a six-field calculator — and it went:
//      see the header of <Pricing> for why comparing bills was the wrong
//      argument to put in front of a price.
//
// A section that gets longer without earning one of those three is regressing,
// and the way to check is to read only the prose and count.
//
// ── SERVER COMPONENTS, DELIBERATELY ─────────────────────────────────────────
//
// Everything here is a server component. `<TheDay>` is the one client boundary
// on the page (it needs a scroll position) and `<Faq>` is the other (Base UI's
// accordion is interactive). That is why the CTAs are real anchors carrying
// `buttonClasses` rather than `<Button render={<a/>}>`: the render form is
// client-only, and it also hands jsx-a11y an empty `<a>` whose text lives in a
// sibling prop.
//
// ── WHAT WAS REMOVED, AND WHY IT IS NOT COMING BACK ─────────────────────────
//
// The page used to open with a headline, a mascot and four product cards, then
// show the SAME four things again 3000px later in a different layout under
// "keep what you're working on open together". One screen depicted twice is the
// page arguing with its own headline. `<TheDay>` is the single depiction, and
// `workbench-glimpse.tsx`, `trade-film.tsx` and `photo-band.tsx` are deleted
// rather than parked — an unused marketing component is a thing somebody
// re-adds.
//
// It also carried a "Three doors. One Piggles." section explaining why the
// product has three domains. That is OUR problem; nobody arrives wondering
// about it. Section 5 answers what somebody actually worries about after being
// shown fifteen apps — "do I have to set all that up?" — and every line of it is
// something the account app genuinely does today (STATUS.md, "Onboarding").

export function HomePage() {
  return (
    // No top padding: the film is the first child and it is a full-bleed dark
    // act, so any page ground above it reads as a seam under the header rather
    // than as spacing. The breathing room around the demo is the mat's own
    // padding, inside the dark — see the-day.tsx.
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
