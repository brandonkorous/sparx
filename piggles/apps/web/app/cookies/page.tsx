import type { Metadata } from 'next';
import { Section } from '@piggles/ui';
import Link from 'next/link';
import { Table } from '@wizeworks/silicaui-react';
import { PRODUCT } from '@piggles/config';
import { ConsentChange } from '@/components/consent-change';
import { PageHero } from '@/components/marketing/page-hero';
import { DocumentFigure } from '@/components/marketing/hero/document-figure';

// /cookies — what each of the three Piggles surfaces actually stores in your
// browser.
//
// ── THIS PAGE IS DERIVED FROM THE CODE, NOT FROM A TEMPLATE ─────────────────
//
// Every row below was read out of the repository. A boilerplate cookie policy
// would have claimed a tracking stack across all three domains, and for a
// product whose /trust page is built on refusing to overclaim, that is the
// wrong kind of lie.
//
// Verified at the time of writing:
//
//   • apps/web (meetpiggles.com)      — no posthog-js and no third-party tag of
//                                    any kind. It records ONE thing, and only
//                                    with permission: where a visit came from
//                                    (lib/attribution.ts), behind the bar in
//                                    components/consent-bar.tsx. The answer
//                                    itself is a cookie too — a remembered "no"
//                                    is the only way to honour a no.
//   • apps/account (getpiggles.com)  — Better Auth session cookie only. The
//                                    attribution arrives in the signup LINK
//                                    (lib/attribution.ts), never in a cookie,
//                                    because three registrable domains cannot
//                                    share one.
//   • apps/workbench (mypiggles.com) — session cookie, the active-site cookie,
//                                    and PostHog gated on the account-level
//                                    consent record.
//
// ── WHAT CHANGED, AND WHY THIS PARAGRAPH IS HERE ────────────────────────────
//
// This page used to say the marketing site "has no tags at all" and "sets
// nothing", which was true and expensive: a visitor arriving from a paid
// campaign carried the campaign in the URL and none of it survived the click to
// signup, so every customer looked like they had simply appeared. Attribution
// cannot be reconstructed after the fact. The decision was to measure it and to
// ASK — not to measure it quietly and leave this page describing a product that
// no longer existed. If the ask is ever removed, this page is wrong again.
//
// ── KEEPING IT TRUE ─────────────────────────────────────────────────────────
//
// This page goes stale the moment somebody adds a tag, a pixel, or a
// `localStorage.setItem` that holds something personal. Anything that writes to
// a visitor's browser is a change to this page as well as to the app. The
// grep that produced it:
//
//   cookies().set | Set-Cookie | document.cookie | localStorage.setItem
//
// ── THE CONSENT ASK, AND WHERE IT IS ────────────────────────────────────────
//
// This file has been wrong about this twice, in opposite directions, and both
// mistakes are worth keeping written down.
//
// First it said a consent ask was "deliberately absent" because nothing here is
// advertising and nothing is set by another company. The first half is true and
// the second was WRONG: PostHog is another company's analytics on mypiggles.com's
// pages, and analytics is not exempt from consent just because it is not
// advertising.
//
// Then the console asked for itself, with a banner, and stored the answer in a
// cookie on mypiggles.com. That gated the tracker correctly and got the MOMENT
// wrong: somebody reached their business before being asked, and the answer sat
// on the domain where they run their business rather than the one where they
// deal with WizeWorks.
//
// It is asked on getpiggles.com now — a checkbox on the signup form, and
// `/cookie-choices` for anyone who arrives without one, which /handoff (the only
// door into the console) will not let past. The answer is recorded on the
// ACCOUNT, in `users.preferences.consent`, because three registrable domains
// cannot share a cookie but all three can read a user row. The console reads it
// and gates PostHog on it; it no longer asks anything.
//
//   • meetpiggles.com — sets nothing. Nothing to ask.
//   • getpiggles.com  — the session cookie, and where the question is put.
//   • mypiggles.com   — reads the answer. Never asks.
//
// If a tag ever lands on THIS site, an ask for it arrives in the same commit —
// and it will need a different mechanism, because this domain has no session to
// record an answer against.

export const metadata: Metadata = {
  title: 'Cookies',
  description:
    'Every cookie Piggles sets, on which of the three sites, what it is for and how long it lasts. No advertising cookies, nothing sold on, and no third-party tags on the marketing site.',
};

interface CookieRow {
  name: string;
  where: string;
  what: string;
  life: string;
}

const ESSENTIAL: CookieRow[] = [
  {
    name: 'piggles-account.session_token',
    where: `${PRODUCT.hosts.account} and ${PRODUCT.hosts.console}`,
    what: 'Keeps you signed in. Each of the two sites sets its own copy on its own address — they cannot share one — and both point at the same single sign-in, so signing out of either ends both.',
    life: 'Until the session expires or you sign out',
  },
  {
    name: 'piggles_active_property',
    where: PRODUCT.hosts.console,
    what: 'Remembers which of your sites you were last working on, so the workspace opens where you left it. It holds an identifier for one of your own sites and nothing about you.',
    life: 'One year',
  },
];

const PRODUCT_ANALYTICS: CookieRow[] = [
  {
    name: 'PostHog (several, all beginning ph_)',
    where: PRODUCT.hosts.console,
    what: 'Product analytics inside the workspace: which screens get used and where something broke. It tells us that a screen is confusing. It is not advertising, it is not sold on, and it is not running on the site you are reading now.',
    life: 'Up to one year',
  },
  {
    name: 'piggles_attr_first',
    where: PRODUCT.hosts.marketing,
    what: 'Where you first came from — a search, an advert, somebody else’s website — so we know what is worth doing more of. Written once and never revised, so however often you come back it still says how you found us the first time. Only set if you say yes.',
    life: 'Up to one year',
  },
  {
    name: 'piggles_attr_last',
    where: PRODUCT.hosts.marketing,
    what: 'The same thing for your most recent visit that came from somewhere. A plain return visit leaves it alone rather than overwriting it. Only set if you say yes.',
    life: 'Up to one year',
  },
  {
    name: 'piggles_consent_state',
    where: PRODUCT.hosts.marketing,
    what: 'Your answer to the question above, so we stop asking. This one is set whichever way you answer — including when you say no, because remembering a no is the only way to honour it.',
    life: 'One year',
  },
];

const FACTS = [
  {
    title: 'None of them are advertising cookies',
    body: 'There is no ad network on any Piggles site, nothing is sold or passed to a data broker, and nothing here follows you to somebody else’s website.',
  },
  {
    title: 'This site asks before it remembers anything',
    body: `${PRODUCT.hosts.marketing} has no advertising tags and no third-party scripts. It does keep one thing, and only if you agree to it: where you came from, so we can tell which of the things we do actually brings anybody here. Say no and it keeps nothing but your no. When you click "start free", what it knows travels in the link — the three Piggles addresses are separate domains and could not share a cookie anyway.`,
  },
  {
    title: 'Signing in with Google is your choice',
    body: `If you sign in with Google rather than a password, Google sets its own cookies as part of that and knows you signed in to ${PRODUCT.name}. A password involves nobody else. Either way ${PRODUCT.name} ends up with the same one session cookie.`,
  },
  {
    title: 'Connecting an outside account does not add cookies here',
    body: 'Linking Instagram, Amazon or a carrier lets Piggles talk to them from our servers — it does not put their tracking on any page you look at. What information travels to them is on the privacy page.',
  },
  {
    title: 'Your own visitors are your business, not ours',
    body: 'The website you build with Piggles is yours. If you add something to it that sets cookies — a chat widget, an ad pixel, a video embed — that is your decision to make and yours to tell your visitors about.',
  },
  {
    title: 'You are asked before anything is counted',
    body: `Twice, because there are two different things to ask about. On this site: may we remember where you came from — answered in the bar at the bottom, changeable whenever you like. Inside ${PRODUCT.hosts.console}: may we see which screens you use — answered on the signup form, or on a screen of its own if you signed up with Google, and kept with your account so it follows you. Say no to either and that one never starts.`,
  },
  {
    title: 'Turning them off',
    body: 'Every browser can block or clear cookies, and you can use Piggles’ public pages with them off entirely. Signing in is the one thing that genuinely needs one: without the session cookie there is no way for the next page to know it is still you.',
  },
];

function Rows({ rows }: { rows: CookieRow[] }) {
  return (
    <Table zebra>
      <thead>
        <tr>
          <th>Cookie</th>
          <th>Where</th>
          <th>What it is for</th>
          <th>How long</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <td className="font-semibold">{row.name}</td>
            <td>{row.where}</td>
            <td>{row.what}</td>
            <td className="whitespace-nowrap">{row.life}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export default function CookiesPage() {
  return (
    <>
      <PageHero
        heading="Cookies, and the short list of them."
        lede="A cookie is a small note a website leaves in your browser so the next page knows something the last one did. Here is every one Piggles uses, which of our three sites uses it, and what it is for."
        figure={
          <DocumentFigure
            sections={`${ESSENTIAL.length + PRODUCT_ANALYTICS.length}, every one named`}
            covers="All three Piggles sites"
          />
        }
      />

      <Section>
        <h2 className="text-3xl font-extrabold sm:text-4xl">The ones that make it work</h2>
        <p className="mt-6 max-w-[70ch] text-lg">
          Without these, signing in does not stay signed in. There is no version of Piggles that
          works without them, which is why there is no switch for them.
        </p>
        <div className="mt-8">
          <Rows rows={ESSENTIAL} />
        </div>
      </Section>

      <Section className="bg-base-100 border-base-300 border-y">
        <h2 className="text-3xl font-extrabold sm:text-4xl">The ones you choose</h2>
        <p className="mt-6 max-w-[70ch] text-lg">
          Two things, asked separately in the two places they apply. On this site: where you came
          from, so we know which of the things we do actually brings anybody here. Inside the
          workspace at {PRODUCT.hosts.console}: which screens you use, so we find out that one is
          confusing before you have to tell us. Neither runs until you say yes, and neither is ever
          sold or passed on.
        </p>
        <div className="mt-8 max-w-[70ch]">
          {/* Your answer for THIS site, and the way to change it. The workspace
              one lives with your account, because it follows the person rather
              than the browser. */}
          <ConsentChange />
        </div>
        <div className="mt-8">
          <Rows rows={PRODUCT_ANALYTICS} />
        </div>
      </Section>

      <Section>
        {/* The count is written out and there are seven of them. It said
              "Four" while rendering seven — a number nobody would check and
              everybody would believe, on the page whose whole job is being
              checkable. If an entry is added or removed, this word changes. */}
        <h2 className="text-3xl font-extrabold sm:text-4xl">Seven things worth knowing</h2>
        <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:gap-10">
          {FACTS.map((f) => (
            <li key={f.title} className="border-base-content border-t-2 pt-5">
              <h3 className="text-xl font-bold">{f.title}</h3>
              <p className="mt-2 max-w-[60ch] text-base">{f.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-14 max-w-[70ch] text-lg">
          More on how your information is handled is on the{' '}
          <Link href="/privacy" className="font-semibold underline">
            privacy page
          </Link>
          , and how it is kept safe is on{' '}
          <Link href="/trust" className="font-semibold underline">
            trust
          </Link>
          .
        </p>
      </Section>
    </>
  );
}
