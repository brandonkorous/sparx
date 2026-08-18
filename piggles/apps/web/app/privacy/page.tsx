import type { Metadata } from 'next';
import { Section } from '@piggles/ui';
import Link from 'next/link';
import { Card, CardBody } from '@wizeworks/silicaui-react';
import { PRODUCT } from '@piggles/config';
import { brandLegal } from '@wizeworks/legal';
import { PageHero } from '@/components/marketing/page-hero';
import { DocumentFigure } from '@/components/marketing/hero/document-figure';

// /privacy — what is collected, where it lives, and who else touches it.
//
// ── WHAT THIS PAGE IS, EXACTLY ──────────────────────────────────────────────
//
// EVERY LINE IS ASSEMBLED FROM THE CODEBASE. Everything below is a thing the
// software demonstrably does — the tables it writes, the services it calls, the
// flags it honours. Nothing is here because other companies say it, and nothing
// describes an intention.
//
// That is also the maintenance rule: this page goes stale the moment the code
// does something it does not describe. A change to what is collected, stored or
// sent is a change to this page in the same commit.
//
// ── THE SUB-PROCESSORS ARE NAMED, AND THAT IS THE POINT ─────────────────────
//
// An earlier version listed four of them by ROLE — "a payment provider", "an
// email provider" — on the reasoning that naming one wrongly is worse than
// describing the job. That reasoning was fine and the conclusion was wrong: it
// meant the page did not cover TikTok, Pinterest, Meta, Google sign-in, Mailgun
// or PostHog, which is most of what a careful person is actually asking about.
// Somebody deciding whether to connect their Instagram cannot be answered with
// "a social provider".
//
// The list is written for where Piggles is GOING, not only where it is today:
// the whole sparx connector surface is coming across. Splitting it into ALWAYS
// and IF_YOU_CONNECT is what keeps that honest — the second group describes data
// flows that exist only because a customer chose them.
//
// ── SOURCES, so the next person can re-check rather than re-guess ───────────
//
//   • Social platforms — wizeworks/packages/social/src/adapters (nine of them).
//   • Sales channels and suppliers — wizeworks/packages/channels, packages/dropship.
//   • Shipping, tax, dropship, AI — wizeworks/packages/integration-framework's provider
//     kinds and the descriptors registered against packages/integrations.
//   • Mailgun, Twilio, Stripe, PayPal, PostHog, Cloudflare — named across
//     packages/* and services/*; PostHog is workbench-only (lib/analytics.ts).
//   • Google sign-in — apps/account/components/social-sign-in.tsx, live today.
//   • Isolation, encryption, exports, BYOK-only AI — sparx/apps/web/app/trust, which
//     is already-approved copy; this page must not contradict it.
//   • Cookies — sparx/apps/web/app/cookies, derived from the code.
//   • Usage metering — wizeworks/packages/usage, RollupTenantDailyUsage.
//
// EXCLUDED ON PURPOSE: sparx.market. piggles/CLAUDE.md RULE #0 — a sparx PRODUCT
// is not a Piggles capability. A Piggles customer cannot list on it, so naming
// it would document a data flow they do not have.
//
// The terms are at /terms and carry the matching clause ("Things you connect").
// Keep the two in step: a promise made there about disconnecting has to be true
// here, and vice versa.

export const metadata: Metadata = {
  title: 'Privacy',
  description:
    'What information Piggles holds, why, where it is stored, and who else can touch it — described plainly, from what the software actually does.',
};

const COLLECTED = [
  {
    title: 'What you tell us to open an account',
    body: 'Your name, your email address, the name of your business, and a password we never store in a readable form. This is the minimum the account needs to exist and to be recoverable if you forget the password.',
  },
  {
    title: 'What you put into the software',
    body: 'Your customers, products, orders, bookings, invoices, messages, pages and files. This is your business’ information, not ours. We hold it so the software can show it back to you, and we do not mine it, sell it, or use it to build anything.',
  },
  {
    title: 'What your own customers give you',
    body: 'When somebody buys from your site or books an appointment, their details land in your Piggles. Legally that is your responsibility and we are handling it on your behalf — same isolation, same encryption, same rules about who can see it.',
  },
  {
    title: 'How much room you are using',
    body: 'Storage, email volume, customer records and team seats, counted daily. That is what the price is based on, so it has to be measured; it is a set of numbers about volume, not a record of what you did.',
  },
  {
    title: 'How the workspace gets used',
    body: 'Inside the workspace, which screens get opened and where something broke — so we can find out that a screen is confusing before you have to tell us. You are asked on the way in, the answer is kept with your account, and saying no means none of it runs.',
  },
  {
    title: 'How you found us — if you say yes',
    body: 'On this site only: whether you arrived from a search, an advert or somebody else’s link, and which campaign it was. It tells us what is worth doing more of. Nothing is recorded until you agree to it in the bar at the bottom of the page, the more precise half (which advert you clicked) is a separate question again, and either answer is changeable whenever you like.',
  },
];

const NEVER = [
  {
    title: 'We do not sell it',
    body: 'Not to advertisers, not to data brokers, not to anybody. There is no arrangement under which your information or your customers’ information leaves us for money.',
  },
  {
    title: 'We do not train AI on it',
    body: 'Not a model of ours, not a shared assistant, not anonymised, not aggregated. Any AI feature runs on a key you connect yourself, so the data goes where you agreed and nowhere else — and you can disconnect it whenever you want.',
  },
  {
    title: 'We never hold your card',
    body: 'Card numbers go straight to the payment provider and come back as a token before they reach us. There is no copy of your card in Piggles to lose, and the same is true of the cards your own customers use.',
  },
  {
    title: 'We do not advertise to you elsewhere',
    body: 'Nothing on a Piggles site follows you onto somebody else’s website. There is no ad network and no advertising pixel on any of the three. If you agree to it, this site notes which advert brought you here — that is us reading the tag already on the link you arrived by, once, and it goes nowhere but our own records.',
  },
];

// ── SUB-PROCESSORS ───────────────────────────────────────────────────────────
//
// NAMED, in two groups, because the difference between them is the whole point:
// the first group is running whether you like it or not, and the second only
// exists if you go and switch it on.
//
// The earlier version of this page described these four by ROLE — "a payment
// provider", "an email provider". That was defensible while Piggles had almost
// no connectors. It stopped being defensible the moment the answer to "does
// this cover TikTok, Pinterest, Meta, Google?" was no. A person deciding whether
// to connect their Instagram cannot be told "a social provider".
//
// Everything below was read out of the platform packages, and the list is
// written for where Piggles is GOING rather than only where it is today —
// the whole sparx connector surface is coming across, quickly.
//
// ONE DELIBERATE OMISSION: sparx.market. piggles/CLAUDE.md RULE #0 — a sparx
// PRODUCT is not a Piggles capability, and it must be excluded rather than
// renamed. A Piggles customer cannot list on it, so naming it here would
// document a data flow that does not exist for them.
const ALWAYS = [
  {
    who: 'Microsoft Azure and Google Cloud',
    why: 'Run the servers, the databases and the file storage. Everything lives in managed data centres in a region we can tell you — not on a machine in an office.',
  },
  {
    who: 'Stripe and PayPal',
    why: 'Take the money. Your subscription goes through them, and so do your own customers’ payments if you sell. They see the card; we see a token and the fact that it worked.',
  },
  {
    who: 'Mailgun',
    why: `Delivers the mail Piggles sends on your behalf — order confirmations, booking reminders, password resets, and anything you send from Messages — from ${PRODUCT.email}.`,
  },
  {
    who: 'Twilio',
    why: 'Sends text messages and carries phone calls, where you use those. Only involved if the feature is.',
  },
  {
    who: 'PostHog',
    why: 'Records how the workspace gets used so we can fix what is confusing. Inside the workspace only — never on this site, and never the contents of anything you have stored.',
  },
  {
    who: 'Cloudflare',
    why: 'Sits in front of the sites to keep them fast and to absorb attacks. It sees requests in transit; it does not hold your business’ records.',
  },
];

const IF_YOU_CONNECT = [
  {
    who: 'Social platforms',
    detail:
      'Facebook · Instagram · Threads · TikTok · LinkedIn · Pinterest · X · YouTube · Google Business',
    why: 'If you connect an account, Piggles can publish to it and read back how the post did. What goes over is what you told it to post, plus the metrics that come back.',
  },
  {
    who: 'Sales channels',
    detail:
      'Amazon · eBay · Etsy · Walmart · TikTok Shop · Faire · Google Shopping · Meta · Pinterest',
    why: 'Listing on a marketplace sends your products, prices and stock counts there, and brings orders back — which means the buyer’s name and delivery address come back with them.',
  },
  {
    who: 'Suppliers and print-on-demand',
    detail: 'Printful · Printify · Spocket · DSers',
    why: 'When a supplier ships to your customer directly, that customer’s name and address has to go to the supplier. There is no version of dropshipping where it does not.',
  },
  {
    who: 'Shipping and postage',
    detail: 'Shippo · EasyPost · UPS · FedEx · USPS · DHL',
    why: 'Buying a label sends the delivery address and parcel details to the carrier, and brings tracking back.',
  },
  {
    who: 'Sales tax',
    detail: 'Avalara · TaxJar',
    why: 'Working out what tax to charge sends the amounts and the addresses involved — not who the customer is.',
  },
  {
    who: 'AI you bring yourself',
    detail: 'Your own key — OpenAI, Anthropic, or another',
    why: 'Piggles never runs AI on our account. You connect your own provider, so anything an assistant reads goes to the company whose key you used, under your agreement with them. Disconnect it and it stops.',
  },
];

const RIGHTS = [
  {
    title: 'Take it with you, whenever',
    body: 'Customers, products, orders, invoices and everything you have written, in formats other software can actually open. You do not have to ask, you do not have to be leaving, and nobody will make it slow on purpose.',
  },
  {
    title: 'Correct it',
    body: 'Everything about you and your business is editable in the software. If something is wrong somewhere you cannot reach, ask and we will fix it.',
  },
  {
    title: 'Have it deleted',
    body: 'Cancel and your information is kept for a short window in case you change your mind or forgot to export, then deleted — including from backups as those age out. Want it gone sooner? Ask.',
  },
  {
    title: 'Ask who has looked at it',
    body: 'Access is limited to the people who need it to run the service, and it is logged. If a support person opened your business to help with something, that is recorded rather than ambient.',
  },
];

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        heading="What we hold, why, and who else can touch it."
        lede="Written for the person running the business rather than for a lawyer: what comes in, where it goes, what we will never do with it, and how to get all of it back."
        figure={
          <DocumentFigure
            sections={`${COLLECTED.length} kinds of information`}
            covers="All three Piggles sites"
            effective={brandLegal('piggles').versions.privacy?.effectiveDate}
          />
        }
      />

      <Section>
        <h2 className="text-3xl font-extrabold sm:text-4xl">What Piggles holds</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COLLECTED.map((c) => (
            <Card key={c.title}>
              <CardBody>
                <h3 className="text-lg font-bold">{c.title}</h3>
                <p className="mt-2 text-base">{c.body}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </Section>

      <Section className="bg-base-100 border-base-300 border-y">
        <div className="grid gap-10 lg:grid-cols-3 lg:gap-16">
          <div>
            <h2 className="text-3xl font-extrabold sm:text-4xl">Four things that never happen.</h2>
            <p className="mt-6 text-lg">
              This is the part worth reading twice, because it is where most software gets you.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:col-span-2">
            {NEVER.map((n) => (
              <div key={n.title}>
                <h3 className="text-xl font-bold">{n.title}</h3>
                <p className="mt-2 text-base">{n.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section>
        <h2 className="text-3xl font-extrabold sm:text-4xl">Who else touches it</h2>
        <p className="mt-6 max-w-[70ch] text-lg">
          Two different lists, and the difference matters more than the names. The first is running
          whether you think about it or not. The second only exists because you went and switched it
          on.
        </p>
        <h3 className="mt-12 text-2xl font-extrabold">Always, to run the service</h3>
        <ul className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-10">
          {ALWAYS.map((s) => (
            <li key={s.who} className="border-base-content border-t-2 pt-5">
              <h4 className="text-xl font-bold">{s.who}</h4>
              <p className="mt-2 text-base">{s.why}</p>
            </li>
          ))}
        </ul>
        <h3 className="mt-16 text-2xl font-extrabold">Only if you connect it</h3>
        <p className="mt-4 max-w-[70ch] text-lg">
          None of these are on until you turn them on, and every one can be disconnected in the same
          place you connected it.
        </p>
        <ul className="mt-8 grid gap-4 lg:grid-cols-2">
          {IF_YOU_CONNECT.map((s) => (
            <li key={s.who} className="bg-base-100 border-base-300 rounded-box border p-5 sm:p-7">
              <h4 className="text-xl font-bold">{s.who}</h4>
              <p className="mt-1.5 text-base font-semibold">{s.detail}</p>
              <p className="mt-3 text-base">{s.why}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── The connector disclaimers ──────────────────────────────────────────
          The part a role-based list could not say at all. Once a customer
          connects Instagram or Amazon, information genuinely leaves us and lands
          with a company whose terms we do not write and whose behaviour we
          cannot control — and the person who decided that was the customer.
          Saying so plainly is both the honest thing and the protective one. */}
      <Section className="bg-base-100 border-base-300 border-y">
        <div className="grid gap-10 lg:grid-cols-3 lg:gap-16">
          <div>
            <h2 className="text-3xl font-extrabold sm:text-4xl">
              What happens when you connect something.
            </h2>
            <p className="mt-6 text-lg">
              Connecting an outside account is genuinely a decision, so it is worth knowing exactly
              what it does.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:col-span-2">
            <div>
              <h3 className="text-xl font-bold">Their rules apply once it arrives</h3>
              <p className="mt-2 text-base">
                What you send to TikTok is held by TikTok, under TikTok’s privacy policy and not
                ours. We can control what leaves; we cannot control what happens after. Before
                connecting something you are not sure about, their policy is the one to read.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold">Only what the job needs</h3>
              <p className="mt-2 text-base">
                A social connection gets posts and their metrics. A carrier gets a delivery address.
                A tax service gets amounts and places, not names. Your customer list is never handed
                over wholesale to anybody.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold">You are the one deciding</h3>
              <p className="mt-2 text-base">
                If a supplier ships to your customer, that customer’s address has to reach the
                supplier — there is no version where it does not. Telling your own customers what
                you have connected, and having the right to send it, is yours to do rather than
                ours.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold">Disconnecting stops it</h3>
              <p className="mt-2 text-base">
                Revoke a connection and Piggles stops sending immediately, and the stored key is
                deleted. What the other company already received is theirs to delete — ask them, and
                their policy says how.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-3xl font-extrabold sm:text-4xl">Signing in with Google</h2>
            <p className="mt-6 max-w-[60ch] text-lg">
              You can create an account with an email and a password, or with Google. Choosing
              Google means Google tells us your name, your email address and that the sign-in worked
              — nothing else, and no access to anything in your Google account. It also means Google
              knows you signed in to Piggles.
            </p>
            <p className="mt-4 max-w-[60ch] text-lg">
              A password works just as well and involves nobody else. Every cookie either route sets
              is listed on{' '}
              <Link href="/cookies" className="font-semibold underline">
                cookies
              </Link>
              .
            </p>
          </div>
          <div>
            <h2 className="text-3xl font-extrabold sm:text-4xl">Where it all sits</h2>
            <p className="mt-6 max-w-[60ch] text-lg">
              In managed data centres run by major cloud providers, in a region we can tell you.
              Several of the companies above operate internationally, so information reaching them
              may be handled outside the country you are in — which is normal for software of this
              kind and worth knowing rather than discovering.
            </p>
            <p className="mt-4 max-w-[60ch] text-lg">
              How it is kept separate from every other business, and encrypted on the way and at
              rest, is on{' '}
              <Link href="/trust" className="font-semibold underline">
                trust
              </Link>
              .
            </p>
          </div>
        </div>
      </Section>

      <Section className="bg-base-100 border-base-300 border-y">
        <h2 className="text-3xl font-extrabold sm:text-4xl">What you can always do</h2>
        <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
          {RIGHTS.map((r) => (
            <li key={r.title} className="border-base-content border-t-2 pt-5">
              <h3 className="text-xl font-bold">{r.title}</h3>
              <p className="mt-2 text-base">{r.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-14 max-w-[70ch] text-lg">
          How your information is kept safe and separate is on{' '}
          <Link href="/trust" className="font-semibold underline">
            trust
          </Link>
          , and every cookie we set is listed on{' '}
          <Link href="/cookies" className="font-semibold underline">
            cookies
          </Link>
          .
        </p>
      </Section>
    </>
  );
}
