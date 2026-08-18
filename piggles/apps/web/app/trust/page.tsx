import type { Metadata } from 'next';
import { FaqSection, Section } from '@piggles/ui';
import Link from 'next/link';
import { Card, CardBody } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { accountUrl } from '@piggles/config';
import { PageHero } from '@/components/marketing/page-hero';
import { TrustFigure } from '@/components/marketing/hero/trust-figure';
import { CloseBand } from '@/components/marketing/close-band';

// /trust — the page a careful person reads before putting their business on
// something.
//
// Written for the actual audience, which is a non-technical owner, not a
// security reviewer. That means no control matrix, no acronym wall, and no
// certification badges. It also means every sentence has to be TRUE rather than
// reassuring, because this is the page you get held to.
//
// ── WHAT IS DELIBERATELY NOT CLAIMED ────────────────────────────────────────
//
//   • Certifications. No SOC 2, no ISO, no badges. We do not have them, and a
//     badge on a page is the cheapest lie in this industry.
//   • Uptime percentages. A number nobody is measuring yet is not a commitment,
//     it is a decoration (see the platform's own rule about never presenting
//     absence as measurement).
//
// The operational promises below — continuous backups, monitoring, a public
// status page, notifying people when something goes wrong — are commitments this
// page makes on the product's behalf. They need to be operationally true on the
// day this site goes live, not the week after.

export const metadata: Metadata = {
  title: 'Trust',
  description:
    'How Piggles keeps your business data safe, separate and yours: isolation at the database, encryption in transit and at rest, real exports, and no AI training on your data.',
};

const PILLARS = [
  {
    title: 'Your data is yours, and leaving is easy',
    body: 'Export your customers, products, orders, invoices and everything you have written, whenever you like, in formats other software can actually open. You do not have to ask, you do not have to be cancelling, and nobody will make it slow on purpose. Software that is hard to leave is relying on something other than being good.',
  },
  {
    title: 'Your business is separated from every other one',
    body: 'Separation is enforced by the database itself, not just by the app in front of it. Every piece of your information is tagged with your business, and the database refuses to return somebody else’s rows even if the software above it asks wrongly. It is a second lock on the same door, and it is the one that holds when the first one has a bug.',
  },
  {
    title: 'Encrypted on the way and at rest',
    body: 'Everything travels over an encrypted connection — your browser, your customers’ browsers, and every connection between the parts of the system. What is stored is encrypted on disk, and the keys are held apart from the data.',
  },
  {
    title: 'Everyone signs in as themselves',
    body: 'No shared password for the shop. Each person has their own account and their own access, so you can give a Saturday assistant the till and the bookings without giving them your payouts. Take access away in one action when somebody leaves; their history stays, their way in does not.',
  },
  {
    title: 'A second lock, if you want one',
    body: 'Turn on two-step sign-in and a stolen password is not enough on its own — signing in also needs a code from your phone. You get backup codes for the day the phone is the problem, and you can hand out access to your team without handing out your own way in.',
  },
  {
    title: 'We never see your card details',
    body: 'Card numbers go straight to the payment provider and are replaced with a token before they reach us. There is no copy of your card in Piggles to be stolen, and the same is true for the cards your own customers use.',
  },
  {
    title: 'AI only ever runs on a key you connect',
    body: 'Piggles does not run AI on your business data using our account, and your business is never used to train anybody’s model. If you want an assistant working with your data you connect your own, and you can disconnect it just as easily.',
  },
];

const OPERATIONS = [
  {
    title: 'Backed up continuously',
    body: 'Not nightly, and not to the same place the live system lives. Restores are tested rather than assumed — a backup nobody has ever restored is a hope.',
  },
  {
    title: 'Watched around the clock',
    body: 'Automated monitoring on the things that matter, so problems usually get noticed before anybody has to report one.',
  },
  {
    title: 'A status page you can check',
    body: 'When something is wrong, there is somewhere public that says so. You should never have to guess whether it is you, your internet, or us.',
  },
  {
    title: 'We tell you when it affects you',
    body: 'If an incident touches your business or your customers, you hear it from us, in plain language, with what happened and what we did about it.',
  },
];

const FAQ = [
  {
    q: 'Do you use my business data to train AI?',
    a: 'No. Not to train a model, not to improve a shared assistant, not anonymised, not aggregated. Any AI feature runs on a key you connect yourself, which means the data goes where you agreed and nowhere else — and you can revoke it whenever you want.',
  },
  {
    q: 'Who at Piggles can see my information?',
    a: 'Access is limited to the people who need it to run the service, and it is logged. If a support person needs to look at your business to help with something, that access is recorded rather than ambient.',
  },
  {
    q: 'What happens to my data if I cancel?',
    a: 'You can export everything before you go. After you cancel, your data is kept for a short window in case you change your mind or forgot to export, and then it is deleted — including from backups as they age out. If you want it gone sooner, ask and we will do it.',
  },
  {
    q: 'Where is my data actually stored?',
    a: 'In managed data centres run by a major cloud provider, in a region we can tell you. It is not on a machine in an office, and it is not spread across services nobody has counted.',
  },
  {
    q: 'Is my customers’ information safe too?',
    a: 'It is treated exactly like yours, because legally and practically it is your responsibility and we are handling it for you. Same separation, same encryption, same rules about who can see it — and their unsubscribes and deletion requests are honoured properly.',
  },
  {
    q: 'What if I need something in writing for a client?',
    a: 'Ask. Plenty of businesses need a straight answer about how their supplier handles data, and we would rather give you a real one than a badge.',
  },
];

/** What every competing page puts here, and why this one does not. Moved from
 *  the home page — see the section comment below. */
const ABSENT = [
  {
    title: 'A certification badge',
    body: 'We don’t have one. A badge on a page is the cheapest lie in this industry.',
  },
  {
    title: 'An uptime percentage',
    body: 'Nobody is measuring it yet. A number nobody measures is a decoration.',
  },
  {
    title: 'A wall of customer logos',
    body: 'We would have to invent them, and you would have no way of knowing.',
  },
];

export default function TrustPage() {
  return (
    <>
      <PageHero
        heading="The boring things, done properly."
        lede="You are about to run your business on this. Here is exactly how your information is kept, who can reach it, and how you get it back — in plain words, with nothing dressed up."
        figure={<TrustFigure />}
      >
        <a
          className={buttonClasses({ color: 'primary', size: 'lg' })}
          href={accountUrl('contact', 'trust-hero')}
        >
          Ask us anything
        </a>
        <Link className={buttonClasses({ variant: 'outline', size: 'lg' })} href="/pricing">
          See pricing
        </Link>
      </PageHero>

      <Section>
        <h2 className="text-3xl font-extrabold sm:text-4xl">Seven things that are always true.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p) => (
            <Card key={p.title}>
              <CardBody>
                <h3 className="text-lg font-bold">{p.title}</h3>
                <p className="mt-2 text-base">{p.body}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </Section>

      <Section className="bg-base-100 border-base-300 border-y">
        <div className="grid gap-10 lg:grid-cols-3 lg:gap-16">
          <div>
            <h2 className="text-3xl font-extrabold sm:text-4xl">Keeping it running.</h2>
            <p className="mt-6 text-lg">
              Security is most of this page, but the thing that actually costs you money on a
              Saturday is the site being down. That gets treated as seriously.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:col-span-2">
            {OPERATIONS.map((o) => (
              <div key={o.title}>
                <h3 className="text-xl font-bold">{o.title}</h3>
                <p className="mt-2 text-base">{o.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── THE REFUSAL, WHICH USED TO BE ON THE HOME PAGE ───────────────────
          Three dashed frames where every competing page puts its proof, each
          saying why it is empty. It sat on the home page and every sentence in
          it had "we" as its subject — three cards about our own editorial
          standards, in a slot a reader gets to while working out whether the
          software can run their business.

          It is not deleted, because it is the most unusual thing this brand has
          to say and DESIGN.md §10 is the reason the rest of the site looks the
          way it does. It belongs HERE, near the bottom of the page somebody
          opened specifically to find out what kind of company this is — where a
          paragraph about us is what they came for rather than an interruption.

          The dashed outline is the same one <TheDay> uses for "hasn't happened
          yet", which is what an absent badge and an unmeasured uptime figure
          both are. */}
      <Section>
        <h2 className="max-w-[26ch] text-3xl font-extrabold sm:text-4xl">
          Three things you will not find anywhere on this site.
        </h2>
        <ul className="mt-10 grid gap-3.5 sm:grid-cols-3">
          {ABSENT.map((a) => (
            <li
              key={a.title}
              className="border-base-300 rounded-box border-[1.5px] border-dashed p-5 sm:p-7"
            >
              <h3 className="text-lg font-extrabold sm:text-xl">{a.title}</h3>
              <p className="mt-2 text-base">{a.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <FaqSection heading="Straight answers." items={FAQ} />

      <CloseBand
        heading="Still want to ask a person? That is what they are for."
        primary={{ label: 'Talk to someone', href: accountUrl('contact', 'trust-close') }}
        secondary={{ label: 'Start free for 14 days', href: accountUrl('signup', 'trust-close') }}
      />
    </>
  );
}
