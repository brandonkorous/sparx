// The cookie table, and the record of what was read out of the repository to
// write it — what each of the three Piggles surfaces stores in your browser.
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
//   • apps/web (meetpiggles.com)      — posthog-js (components/posthog-provider.tsx)
//                                    AND the attribution capture
//                                    (lib/attribution.ts). BOTH are registered
//                                    through the same `analytics` grant and stay
//                                    dormant until the bar in
//                                    components/consent-bar.tsx is accepted.
//                                    There is still no advertising tag and no ad
//                                    network. The answer itself is a cookie too
//                                    — a remembered "no" is the only way to
//                                    honour a no.
//   • apps/account (getpiggles.com)  — Better Auth session cookie only. The
//                                    attribution arrives in the signup LINK
//                                    (lib/attribution.ts), never in a cookie,
//                                    because three registrable domains cannot
//                                    share one.
//   • apps/workbench (mypiggles.com) — session cookie, the active-site cookie,
//                                    the screen-shape cookie, and PostHog gated
//                                    on the account-level consent record.
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
//   • meetpiggles.com — asks in its own bar, and keeps the answer in a cookie.
//   • getpiggles.com  — the session cookie, and where the console's question is put.
//   • mypiggles.com   — reads the console's answer. Never asks.
//
// ── AND THEN A TAG DID LAND ON THIS SITE ────────────────────────────────────
//
// The paragraph above used to end "meetpiggles.com — sets nothing. Nothing to
// ask", and promised that if a tag ever landed here, an ask for it would arrive
// in the same commit. PostHog landed, and the ask did arrive with it — though
// not as a new one. The bar was already asking the right question for it: the
// `analytics` grant covers being counted, and counting a landing is the same
// category as remembering where the landing came from. So there is still ONE
// question on this site, and PostHog is registered through the same
// `gateTracker` seam as the attribution capture.
//
// The mechanism the old note worried about turned out not to be needed, for the
// reason it named: this domain has no session, so the answer stays a cookie.

import { PRODUCT } from '@piggles/config';

export interface CookieRow {
  name: string;
  where: string;
  what: string;
  life: string;
}

export const ESSENTIAL: CookieRow[] = [
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
  {
    name: 'piggles_compact',
    where: PRODUCT.hosts.console,
    what: 'Whether the window you are working in is phone-sized or desktop-sized, so the workspace opens in the right shape instead of drawing the wide version first and rearranging itself in front of you. It is one yes-or-no about the window, not about you.',
    life: 'Until you close the browser',
  },
];

export const PRODUCT_ANALYTICS: CookieRow[] = [
  {
    name: 'PostHog (several, all beginning ph_)',
    where: `${PRODUCT.hosts.marketing} and ${PRODUCT.hosts.console}`,
    what: 'Counts pages being opened. On this site it tells us how many people a thing we did actually brought here, which is the only way to know whether it was worth doing. Inside the workspace it tells us which screens get used and where something broke. It is not advertising, none of it is sold on, and on this site it does not start at all unless you say yes.',
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

export const FACTS = [
  {
    title: 'None of them are advertising cookies',
    body: 'There is no ad network on any Piggles site, nothing is sold or passed to a data broker, and nothing here follows you to somebody else’s website.',
  },
  {
    title: 'This site asks before it counts anything',
    body: `${PRODUCT.hosts.marketing} has no advertising tags and no ad network. It does two things, and only if you agree to them: it counts pages being opened, and it remembers where you came from. Between them they tell us whether a thing we did brought anybody here, which is the only way to know whether to do it again. Say no and it keeps nothing but your no. When you click "start free", what it knows travels in the link, because the three Piggles addresses are separate domains and could not share a cookie anyway.`,
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
    body: `Twice, because there are two different places to ask about. On this site: may we count your visit and remember where you came from. That is answered in the bar at the bottom and changeable whenever you like. Inside ${PRODUCT.hosts.console}: may we see which screens you use. That one is answered on the signup form, or on a screen of its own if you signed up with Google, and kept with your account so it follows you. Say no to either and that one never starts.`,
  },
  {
    title: 'Turning them off',
    body: 'Every browser can block or clear cookies, and you can use Piggles’ public pages with them off entirely. Signing in is the one thing that genuinely needs one: without the session cookie there is no way for the next page to know it is still you.',
  },
];
