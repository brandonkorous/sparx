import { Section } from '@piggles/ui';
import { PigglesMascot } from '@piggles/mascot/react';
import { WhatYouPayForm } from './what-you-pay-form';

// /pricing · the beat between the price and its small print.
//
// The hero states the price and the section under this one states the allowances.
// What neither of them says is what the price is measured AGAINST, which is the only
// question somebody on a pricing page actually has. This is where they answer it
// with their own numbers.
//
// ── THIS ARGUMENT WAS REJECTED ONCE, AND THIS IS NOT THE SAME PLACE ─────────
//
// home.tsx records a six-field calculator cut from the home page's price
// section, because comparing bills was the wrong argument to put IN FRONT OF a
// price. That still holds: a reader who has not yet been told there is one plan
// does not need a spreadsheet. Here they have been told, twice, and are deciding
// whether to believe it — so the comparison sits BEHIND the price rather than in
// front of it, on the one page whose whole job is that decision.
//
// ── EVERY FIGURE IS THEIRS OR IT IS OURS ───────────────────────────────────
//
// No competitor price appears, no market average, no "businesses like yours
// typically spend". instead-of.tsx names the products on Brandon's instruction
// and publishes no price but ours; that rule is what makes this section legible
// as arithmetic rather than as an advert with fields in it. Nothing is
// pre-filled, and the panel can return "Piggles is not the cheaper option for
// you" — see what-you-pay-receipt.tsx.
//
// ── A PANEL, NOT A BAND ─────────────────────────────────────────────────────
//
// The rest of this page is flat bands. This is the one object on it you can
// touch, and the site already has a device that says so — the lifted panel the
// home page gives its onboarding form and its ten-bills argument.

/** Nothing ticked yet. The mascot is rendered HERE, on the server, and passed
 *  down: importing her into the client form would pull the whole pose catalog
 *  into the bundle to draw one empty state. */
function Blank() {
  return (
    <div className="rounded-box border-base-300 flex flex-col items-center border border-dashed px-6 py-14 text-center">
      <PigglesMascot intent="empty" size="sm" />
      <p className="mt-6 text-xl font-bold">Nothing ticked yet.</p>
      <p className="mt-2 max-w-sm text-base">
        Start with the ones you know you pay for. It adds up as you go, and it works out the same
        whether you put the amounts in or not.
      </p>
    </div>
  );
}

export function WhatYouPay() {
  return (
    <Section variant="panel" className="bg-base-100 shadow">
      <div className="rise max-w-[62ch]">
        <h2 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">
          What are you paying for all this now?
        </h2>
        <p className="mt-6 text-lg">
          Not what we think you spend — what you actually do. Tick what you pay for, add the amounts
          if you know them, and put your own hours in if you want the rest of it. Every number below
          is one you typed, except ours.
        </p>
      </div>

      <WhatYouPayForm blank={<Blank />} />
    </Section>
  );
}
