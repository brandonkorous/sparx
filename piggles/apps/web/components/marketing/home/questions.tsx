import { FaqSection } from '@piggles/ui';

// ── 8 · QUESTIONS ────────────────────────────────────────────────────────────
//
// Verbatim from /pricing and /trust. A shorter version of an answer on the page
// somebody is about to be held to is how the two drift apart.
const QUESTIONS = [
  {
    q: 'Do I need a card to try it?',
    a: 'No. The trial is fourteen days with no card. If you decide not to carry on, nothing happens — there is no charge to cancel before.',
  },
  {
    q: 'What happens if I go over one of the limits?',
    a: 'Nothing you already have is touched, and nothing you are part way through is stopped. You get a quiet notice as you approach it, and the option to add more room in one tap at the moment it matters — with the price on the button, not behind it. If you do nothing, only new additions of that one kind pause. Your website stays up, your customers stay visible, and order confirmations and password resets always go out regardless.',
  },
  {
    q: 'Can I take my data with me if I leave?',
    a: 'All of it, whenever you want, in formats other software can actually read — customers, products, orders, invoices and everything you have written. You do not have to ask, and you do not have to be leaving.',
  },
  {
    q: 'What if I run two businesses?',
    a: 'Each business is its own subscription, with its own website, customers and books kept completely separate. That is deliberate: sharing them is almost always a mistake you find out about at tax time.',
  },
  {
    q: 'Do you use my business data to train AI?',
    a: 'No. Not to train a model, not to improve a shared assistant, not anonymised, not aggregated. Any AI feature runs on a key you connect yourself, which means the data goes where you agreed and nowhere else — and you can revoke it whenever you want.',
  },
  {
    q: 'Is there a discount for paying yearly?',
    a: 'Not yet. When there is, it will be a straightforward reduction rather than a different plan with different limits.',
  },
];

export function Questions() {
  return (
    <FaqSection
      heading={
        <>
          Questions people <span className="text-primary">actually</span> ask.
        </>
      }
      lede="The six that come up before anybody signs anything."
      items={QUESTIONS}
    />
  );
}
