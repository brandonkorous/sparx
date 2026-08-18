import { Faq, type FaqItem } from '../faq';

/**
 * Partner-specific FAQ — the real objections, grounded in the shipped rules
 * (docs/114 §B.3/§B.4 + partners-spec §6/§7): Stripe Connect payouts, 30-day
 * attribution, snapshotted rates, the tier ladder. Emitted as FAQPage JSON-LD by
 * `<Faq>` for answer-engine extraction.
 *
 * The "is Informal instant?" answer changed. Four surfaces used to disagree: the
 * page said "Informal auto-approves — you're in immediately", the apply form's
 * helper said "Approved instantly", this FAQ said "approved instantly", and the
 * form's own confirmation screen said "EVERY application is reviewed by the
 * Sparx team — no tier activates automatically". Someone applying would read two
 * contradictory promises inside one form. Everything now states the reviewed
 * version, which is what the code actually does.
 */
const PARTNER_FAQ: FaqItem[] = [
  {
    id: 'p-commission',
    question: 'How does commission get paid?',
    answer:
      'Monthly, to your own Stripe account, once you are over $50. It is calculated on net revenue after payment fees. Informal earns 20% of a referred client’s first payment, Registered earns 30%, and Certified earns 30% plus 5% of every month after on accounts you manage — for as long as that client stays.',
  },
  {
    id: 'p-worth',
    question: 'Realistically, how much is that?',
    answer:
      'A client running a site, store, content, CRM and email pays $186 a month on sparx. As a Certified partner that is about $56 when their first invoice clears, then roughly $9 a month for as long as you manage them. Ten such clients is around $560 up front and $1,100 a year after. It is meant to sit on top of what you already charge, not replace it — and the client’s side of the same trade is roughly $9,800 a year each that stops going to software.',
  },
  {
    id: 'p-tracking',
    question: 'How are my referrals tracked?',
    answer:
      'Your referral link carries a code kept in a first-party cookie for 30 days. Anyone who signs up inside that window is credited to you, and your rate is locked in at that moment — so a later rate change never rewrites your history. There is no backdating: a signup with no referral code credits nobody.',
  },
  {
    id: 'p-account',
    question: 'Do I need my own sparx account to apply?',
    answer:
      'No. Apply first and sort the account out after — you will be prompted to create one to activate your referral link. If you already run a sparx site, we link the partner record to it.',
  },
  {
    id: 'p-review',
    question: 'How long does approval take?',
    answer:
      'Three business days at the outside, for every tier including Informal. Every application is read by a person; none of them activates automatically. It is a quick look at who you are and how you work with clients, not an interview.',
  },
  {
    id: 'p-tiers',
    question: 'What is the real difference between the three tiers?',
    answer:
      'How much you put in up front, and whether the money stops. Informal is an application and a link at 20%. Registered adds a look at your work, pays 30%, skips the support queue, and lets you build bootcamps privately. Certified requires finishing a self-paced certification, and is the only tier that keeps paying after the first invoice — 30% plus 5% ongoing, a named partner manager, top of the directory, publicly listed bootcamps, co-marketing, and new modules before anyone else.',
  },
  {
    id: 'p-bootcamps',
    question: 'Can I host bootcamps?',
    answer:
      'Registered partners can build bootcamp listings but keep them unpublished; Certified partners publish theirs publicly on sparx.works/bootcamp with the Certified badge. Everyone who registers becomes a lead in your own CRM, which makes a bootcamp one of the most direct ways to bring businesses onto the platform under your referral.',
  },
  {
    id: 'p-churn',
    question: 'What happens if a referred client cancels?',
    answer:
      'You lose a first-payment commission only if the client leaves before that first payment clears. Once it clears it is yours. Ongoing commission simply stops if the client leaves or is no longer a managed account — nothing is ever clawed back.',
  },
];

export function PartnersFaq() {
  return (
    <Faq
      id="faq"
      items={PARTNER_FAQ}
      heading={
        <>
          Partner questions
          <span className="text-primary">.</span>
        </>
      }
      lede="Commissions, tracking, tiers and payouts — the specifics, before you spend two minutes applying."
    />
  );
}
