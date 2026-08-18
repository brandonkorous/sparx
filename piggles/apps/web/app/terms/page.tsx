import type { Metadata } from 'next';
import { Section } from '@piggles/ui';
import Link from 'next/link';
import { brandLegal } from '@wizeworks/legal';
import { PageHero } from '@/components/marketing/page-hero';
import { DocumentFigure } from '@/components/marketing/hero/document-figure';

// /terms — the agreement, in the same plain speech as the rest of the site.
//
// ── WHERE THE FACTS COME FROM ───────────────────────────────────────────────
//
// Terms are promises somebody chooses to make, so unlike /cookies this page
// could not be read off the code alone. Every commercial and operational term
// below is nonetheless taken from something already committed to in writing,
// and where the two could disagree, the other page wins:
//
//   • $49/month · 1 business · 1 location · 1 site · 3 users · 14 days free
//     with no card — piggles/CLAUDE.md RULE #2 and sparx/apps/web/app/pricing.
//   • A capacity limit never stops work in progress and never degrades what
//     exists — RULE #2 again, and BILLING_RULES.md.
//   • Export anything, any time; deletion after a short window — sparx/apps/web/app/trust.
//   • No AI training on customer data; BYOK only — /trust and /privacy.
//   • Cards never reach us — /trust.
//   • The entity, its home and its year — docs/01-platform-vision.md:
//     WizeWorks LLC, Visalia, California, incorporated 2026. That is also where
//     the governing law comes from; it is recorded, not assumed.
//
// ── EVERY CLAUSE IS ONE PIGGLES ALREADY KEEPS ──────────────────────────────
//
// Nothing here is aspirational and nothing is in it because other companies have
// one. If a clause and the pricing, trust or privacy page could disagree, the
// other page wins and this one is the mistake.

export const metadata: Metadata = {
  title: 'Terms',
  description:
    'The agreement between you and WizeWorks for using Piggles — what you get, what it costs, what you can and cannot do, and how either of us can end it. In plain words.',
};

const ENTITY = 'WizeWorks LLC';
const HOME = 'Visalia, California, United States';

interface Clause {
  heading: string;
  paras: string[];
}

const CLAUSES: Clause[] = [
  {
    heading: 'Who you are agreeing with',
    paras: [
      `Piggles is made and run by ${ENTITY}, a company based in ${HOME}. When this page says “we” or “us”, that is who it means. When it says “you”, it means the person or the business using Piggles.`,
      `Using Piggles means you accept what is on this page. If you are setting it up for a business rather than for yourself, you are confirming you are allowed to agree on that business’ behalf.`,
    ],
  },
  {
    heading: 'What you get',
    paras: [
      'One subscription gives you every one of the fifteen apps, from the first day. There are no tiers, no per-app charges and nothing behind an upgrade button. If it is one of the fifteen, it is included.',
      'One subscription covers one business, one location, one website on your own domain, and three people on your team. A second business is a second subscription — deliberately, because sharing customers and books between two businesses is a mistake that usually surfaces at tax time.',
      'We add things, change things and occasionally remove things. If we remove something you are relying on, we will tell you before it happens rather than after.',
    ],
  },
  {
    heading: 'The free trial',
    paras: [
      'Fourteen days, no card. Nothing is charged during the trial and nothing happens automatically at the end of it — if you decide not to carry on, there is nothing to cancel and nothing to pay.',
      'One trial per business. Opening a series of accounts to keep trialling is the sort of thing we will ask you to stop doing.',
    ],
  },
  {
    heading: 'Paying',
    paras: [
      '$49 a month per business, in advance, from the day you decide to carry on after the trial. Prices are in US dollars and exclude any sales tax or VAT that applies where you are.',
      'Your card is handled by our payment provider and is replaced with a token before it reaches us. We never hold your card number.',
      'If a payment fails we will try again and tell you. We will not switch your business off over a payment problem without warning you first and giving you a real chance to fix it.',
      'If we ever change the price, you get at least thirty days’ notice before it applies to you, and cancelling instead is always an option.',
    ],
  },
  {
    heading: 'Room, and what happens when you need more',
    paras: [
      'The price covers a set amount of room: storage, email sends, customer records and team seats. Products, services, orders, bookings and invoices are not counted — selling more is the point, not a penalty.',
      'Reaching a limit never stops something you are part way through and never degrades what already exists. Your website stays up, your customers stay visible, and order confirmations and password resets always go out. Only new additions of that one kind pause.',
      'Adding room is one tap with the price on the button, and removing it again is the same. A purchase that is easy to make and hard to undo is a trap rather than a feature.',
    ],
  },
  {
    heading: 'Your information stays yours',
    paras: [
      'Everything you put into Piggles — your customers, products, orders, invoices, pages, files and words — belongs to you. Nothing about using Piggles transfers ownership of it to us.',
      'We need a narrow permission to run the service: to store your information, back it up, and display and send it as the software is meant to. That permission exists only to operate Piggles for you, it goes no further, and it ends when you leave.',
      'We do not sell your information, and we do not train AI on it — not a model of ours, not a shared assistant, not anonymised, not aggregated. Any AI feature runs on a key you connect yourself.',
      'You can export all of it whenever you want, in formats other software can actually read. You do not have to ask, and you do not have to be leaving.',
    ],
  },
  {
    heading: 'Your own customers’ information',
    paras: [
      'When somebody buys from your site or books an appointment, their details are yours to look after and we are handling them for you. You decide what is collected and why; we keep it isolated, encrypted and available to you.',
      'That means the promises you make to your own customers are yours to keep. Honour their unsubscribes and their deletion requests — the software has the tools for both, and using them is your responsibility rather than ours.',
    ],
  },
  {
    heading: 'Things you connect',
    paras: [
      'Piggles connects to a lot of other software — social accounts, marketplaces, suppliers, carriers, tax services, payment providers, and an AI provider if you bring your own key. None of it is on until you switch it on.',
      'When you connect something, information genuinely goes to that company, and once it arrives their terms and their privacy policy apply rather than ours. We are not responsible for what they do with it, for their outages, for a change to their rules, or for an account of yours that they suspend.',
      'You are the one deciding to send it, so having the right to send it is yours too — including telling your own customers what you have connected where they need to know. A supplier who ships to your customer has to be given that customer’s address; there is no version of that which avoids it.',
      'You can disconnect anything at any time, in the same place you connected it. Piggles stops sending immediately and deletes the stored key. What the other company already has is between you and them.',
      'These connections can also stop working through no fault of ours — an outside company changes an interface, withdraws access, or goes away. We will fix what we can and tell you what we cannot.',
    ],
  },
  {
    heading: 'What you cannot do with it',
    paras: [
      'Do not use Piggles to break the law, to sell what you are not allowed to sell, or to handle somebody else’s information without the right to do so.',
      'Do not send bulk email to people who did not ask for it. Sending is a shared reputation: one business mailing a purchased list damages delivery for every other business on Piggles, so this is the rule we enforce most firmly.',
      'Do not attempt to reach another business’ information, to get around the limits your subscription sets, or to test our security without asking us first. Ask, and we will usually say yes.',
      'Do not resell Piggles as if it were your own product. Building sites and running businesses for your clients on it is fine and expected; passing it off as software you made is not.',
    ],
  },
  {
    heading: 'Keeping it running',
    paras: [
      'We do not promise a percentage. We have deliberately not published an uptime figure, because we are not yet measuring one and a number nobody measures is a decoration rather than a commitment.',
      'What we do commit to: continuous backups kept somewhere other than the live system, monitoring around the clock, a public status page, and telling you in plain language when something affects your business or your customers.',
      'Occasionally we need to take something down on purpose to work on it. Where we can plan it, we will tell you beforehand and do it at the quietest time we can find.',
    ],
  },
  {
    heading: 'Support',
    paras: [
      'A person answers. Support comes from people who know the product, and a ticket is not closed for being inactive.',
      'Support covers using Piggles. It does not extend to running your business for you, writing your content, or fixing something a third party you connected has broken — though we will usually tell you what we can see.',
    ],
  },
  {
    heading: 'Ending it',
    paras: [
      'You can cancel whenever you like, from inside your account, without talking to anybody. Cancelling stops the next payment; it does not refund the part of the month you have already had.',
      'We can end an account for a serious or repeated breach of the rules above — the sending rules especially. Except where the law or an emergency requires otherwise, we will tell you what is wrong and give you a chance to put it right first.',
      'After an account ends, your information is kept for a short window in case you change your mind or forgot to export, and is then deleted, including from backups as those age out. If you want it gone sooner, ask and we will do it.',
    ],
  },
  {
    heading: 'Changes to this page',
    paras: [
      'These terms will change as the product does. For anything that materially affects you, you get at least thirty days’ notice by email before it takes effect, and carrying on using Piggles after that is how the new version is accepted.',
      'Corrections that do not change what either of us has agreed — a clearer sentence, a fixed typo — we will simply make.',
    ],
  },
  {
    heading: 'Where we stand legally',
    paras: [
      'Piggles is provided as it is. We work hard to keep it correct and available, and we cannot promise it will never be unavailable or never contain a mistake.',
      'We are not liable for business losses that follow from using or being unable to use Piggles — lost profit, lost sales, lost goodwill — and our total liability in any twelve-month period is limited to what you paid us during it. Nothing here limits anything that cannot lawfully be limited.',
      `This agreement is governed by the laws of the State of California, United States, and the courts there are where a dispute would be heard. ${ENTITY} is based in ${HOME}.`,
    ],
  },
];

export default function TermsPage() {
  return (
    <>
      <PageHero
        heading="The agreement, in plain words."
        lede="What you get, what it costs, what you can and cannot do with it, and how either of us can end it. Written to be read rather than to be survived."
        figure={
          <DocumentFigure
            sections={`${CLAUSES.length} clauses`}
            covers="Your Piggles subscription"
            effective={brandLegal('piggles').versions.terms?.effectiveDate}
          />
        }
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-[16rem_1fr] lg:gap-16">
          {/* A real index. Twelve clauses is a lot to scroll blindly, and the
              one thing somebody wants is usually the one thing they cannot
              find — most often cancelling, or who owns what. */}
          <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
            <h2 className="text-base font-bold">On this page</h2>
            <ul className="border-base-300 mt-4 space-y-2 border-l pl-4">
              {CLAUSES.map((c) => (
                <li key={c.heading}>
                  <Link href={`#${slug(c.heading)}`} className="text-base">
                    {c.heading}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="max-w-[75ch]">
            {CLAUSES.map((c) => (
              <section key={c.heading} id={slug(c.heading)} className="scroll-mt-28 pb-12">
                <h2 className="text-2xl font-extrabold sm:text-3xl">{c.heading}</h2>
                {c.paras.map((p) => (
                  <p key={p.slice(0, 40)} className="mt-4 text-lg">
                    {p}
                  </p>
                ))}
              </section>
            ))}

            <div className="border-base-300 border-t pt-8">
              <p className="text-lg">
                How your information is handled is on{' '}
                <Link href="/privacy" className="font-semibold underline">
                  privacy
                </Link>
                , how it is kept safe is on{' '}
                <Link href="/trust" className="font-semibold underline">
                  trust
                </Link>
                , every cookie is listed on{' '}
                <Link href="/cookies" className="font-semibold underline">
                  cookies
                </Link>
                , and what is running right now is on{' '}
                <Link href="/status" className="font-semibold underline">
                  status
                </Link>
                .
              </p>
              <p className="mt-4 text-base">
                Questions about any of it: ask, and you will get a straight answer from a person.
              </p>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

/** Stable anchor per clause. Kept next to the data so a renamed heading cannot
 *  quietly break its own link. */
function slug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
