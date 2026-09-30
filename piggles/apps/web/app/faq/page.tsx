import type { Metadata } from 'next';
import Link from 'next/link';
import { FaqSection, Section } from '@piggles/ui';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { accountUrl, APP_COUNT_WORD } from '@piggles/config';
import { PRICE_LABEL, TRIAL_DAYS } from '@piggles/config/pricing';
import { PageHero } from '@/components/marketing/page-hero';
import { CloseBand } from '@/components/marketing/close-band';
import { FaqJsonLd } from '@/components/marketing/faq-jsonld';

// /faq: the questions asked before buying, in one place, grouped by what the
// asker is worried about. Answers restate what the rest of the site already
// says (pricing, trust, the app pages, the handoff facts table) and link to it;
// this page never makes a claim no other page makes.

export const metadata: Metadata = {
  title: 'Questions about Piggles',
  description: `Answers to what people ask before they start: what Piggles is, what it costs, what it does and does not do, moving over, your data, and getting help. ${PRICE_LABEL} a month, every app included.`,
  alternates: { canonical: '/faq' },
};

const GROUPS: { id: string; heading: string; items: { q: string; a: string }[] }[] = [
  {
    id: 'basics',
    heading: 'What it is',
    items: [
      {
        q: 'What is Piggles?',
        a: `Business software for people who have a business to run. It is ${APP_COUNT_WORD} apps in one place: your website, selling, stock, suppliers, customers, messages, bookings, invoices, money, your team, campaigns and automations. They share one customer list, one catalog and one set of numbers.`,
      },
      {
        q: 'Who is it for?',
        a: 'Owners and small teams: salons, bakeries, garages, studios, shops, trades, suppliers and side businesses. If you sell, book, quote or invoice, and you are tired of paying for a separate tool for each, it is for you.',
      },
      {
        q: 'Do I need to install anything?',
        a: 'No. Piggles works in the browser on a computer, a tablet or a phone. There is no app to download.',
      },
      {
        q: 'Who makes it?',
        a: 'WizeWorks LLC, a software company in Visalia, California. The agreement you make when you sign up is with WizeWorks.',
      },
    ],
  },
  {
    id: 'price',
    heading: 'What it costs',
    items: [
      {
        q: 'How much is it?',
        a: `${PRICE_LABEL} a month, with every app included. There are no tiers and no app costs extra. Your bill only changes if you add room: another location, another team member, more storage, more email sends or more customer records.`,
      },
      {
        q: 'Is there a free trial?',
        a: `Yes. ${TRIAL_DAYS} days, with no card needed. If you decide not to carry on, nothing happens and there is nothing to cancel.`,
      },
      {
        q: 'Does Piggles take a fee on my sales?',
        a: 'No. Piggles adds nothing to a sale. The payment company you connect charges its own card fee, the same as it would anywhere.',
      },
      {
        q: 'What happens if I reach a limit?',
        a: 'Nothing you already have is touched. You get a notice as you approach it and the option to add room in one tap, with the price on the button. If you do nothing, only new additions of that one kind pause. Your site stays up and order emails keep going out.',
      },
      {
        q: 'What if I run two businesses?',
        a: 'Each business is its own subscription, with its own website, customers and money kept completely apart.',
      },
    ],
  },
  {
    id: 'does',
    heading: 'What it does, and does not do',
    items: [
      {
        q: 'Can I take card payments in person?',
        a: 'Piggles has no card reader of its own. You can record a counter sale as an order, and if you use a Square reader you can keep it. Online and on invoices, customers pay through the payment company you connect.',
      },
      {
        q: 'Is Piggles accounting software?',
        a: 'Partly. Money is light bookkeeping: your profit and loss, spending by category, recurring costs, bills to pay, money customers owe you, and profit per job. Your spending downloads as a spreadsheet with your accountant’s account codes. It is not a full ledger: there is no chart of accounts, no bank matching and no tax returns, and it does not sync with QuickBooks or Xero. Keep your accountant’s software for the books.',
      },
      {
        q: 'Does it do payroll?',
        a: 'No. My Team records clock-ins, timesheets and time off, and a period’s approved hours download as a file for whoever runs your payroll.',
      },
      {
        q: 'Does it send text messages?',
        a: 'No. Messages sends email and runs live chat on your website.',
      },
      {
        q: 'Can I sell on Amazon, eBay or Etsy through Piggles?',
        a: 'No. Piggles sells on your own website, over the counter and on trade accounts.',
      },
      {
        q: 'Can I use my own domain?',
        a: 'Yes, with its security certificate included. Your email can come from an address at your domain too.',
      },
    ],
  },
  {
    id: 'moving',
    heading: 'Moving over',
    items: [
      {
        q: 'Can I bring my records from my old software?',
        a: 'Yes. Move in reads the exports from Shopify, Square, Wix, Squarespace, WordPress, HubSpot and more than a dozen others, or any spreadsheet. You see what will happen to every row before anything is saved.',
      },
      {
        q: 'Do I have to stop using my old software first?',
        a: 'No. Moving in reads a copy and changes nothing on the old platform. Run both while you decide.',
      },
    ],
  },
  {
    id: 'data',
    heading: 'Your data',
    items: [
      {
        q: 'Can I take my data with me if I leave?',
        a: 'Yes. Customers, products, stock, orders, invoices, bookings and articles each download as a spreadsheet from the list they live on, whenever you like. You do not have to ask.',
      },
      {
        q: 'Do you use my business data to train AI?',
        a: 'No. Not to train a model, not to improve a shared assistant, not anonymized. Any AI feature runs on an account you connect yourself.',
      },
      {
        q: 'Is my data kept apart from other businesses?',
        a: 'Yes, at the database itself, and it is encrypted in transit and at rest. The details are on the trust page.',
      },
    ],
  },
  {
    id: 'help',
    heading: 'Getting help',
    items: [
      {
        q: 'Can I talk to a person?',
        a: 'Yes. Write to us from the contact page and a person answers, not a bot.',
      },
      {
        q: 'How do I know if Piggles is working right now?',
        a: 'The status page checks each part of Piggles the moment you open it and shows whether it answered.',
      },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.items);

export default function Faq() {
  return (
    <>
      <FaqJsonLd path="/faq" name="Questions about Piggles" items={ALL} />
      <PageHero
        heading="Questions people ask before they start."
        lede="What Piggles is, what it costs, what it does and does not do, moving over, your data, and getting help. Short answers, with the long version one click away."
      >
        <a
          className={buttonClasses({ color: 'primary', size: 'lg' })}
          href={accountUrl('signup', 'faq')}
        >
          Start free for 14 days
        </a>
        <a
          className={buttonClasses({ variant: 'outline', size: 'lg' })}
          href={accountUrl('contact', 'faq')}
        >
          Ask your own question
        </a>
      </PageHero>

      <Section>
        <nav aria-label="Topics" className="flex flex-wrap gap-3">
          {GROUPS.map((g) => (
            <a
              key={g.id}
              href={`#${g.id}`}
              className={buttonClasses({ variant: 'outline', size: 'md' })}
            >
              {g.heading}
            </a>
          ))}
        </nav>
      </Section>

      {GROUPS.map((g) => (
        <div key={g.id} id={g.id}>
          <FaqSection heading={g.heading} items={g.items} />
        </div>
      ))}

      <Section variant="panel" className="bg-base-100 shadow">
        <h2 className="text-3xl font-extrabold sm:text-4xl">The long versions</h2>
        <ul className="mt-8 grid gap-3 text-lg sm:grid-cols-2">
          {[
            ['/pricing', 'Everything on the price'],
            ['/trust', 'How your data is kept safe'],
            ['/switching', 'Moving to Piggles'],
            ['/what-connects', 'What Piggles connects to'],
            ['/compare', 'Piggles compared with others'],
            ['/how-it-works', 'How getting started works'],
          ].map(([href, label]) => (
            <li key={href}>
              <Link href={href ?? '/'} className="font-bold underline underline-offset-4">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <CloseBand
        heading="Still wondering? Try it for fourteen days and see."
        primary={{ label: 'Start free for 14 days', href: accountUrl('signup', 'faq-close') }}
        secondary={{ label: 'Talk to a person', href: accountUrl('contact', 'faq-close') }}
      />
    </>
  );
}
