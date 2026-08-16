/**
 * A privacy policy and a set of terms, generated from a short form.
 *
 * ── THE BRIEF: READABLE, NOT LONG ───────────────────────────────────────────
 *
 * Generated policies are usually nine pages, because length reads as
 * thoroughness and nobody has ever complained that a legal document was too
 * comprehensive. It is the wrong instinct. The obligation is to TELL people what
 * happens to their information, and a disclosure nobody can read has not
 * disclosed anything — burying the answer is closer to hiding it than to saying
 * it.
 *
 * So these are written in short sections with plain headings and no defined
 * terms. "We" is the business. "You" is the person reading. Nothing is
 * capitalised for effect, and there is no clause that exists only to make the
 * document look like a legal document.
 *
 * ── WHAT THIS IS NOT ────────────────────────────────────────────────────────
 *
 * It is not legal advice, it says so on the page, and it says so in the document
 * itself rather than only in the small print of the tool. Anybody doing anything
 * unusual with personal information — health data, children, several countries
 * at once — needs a lawyer, and telling them so plainly is more useful than
 * generating another eight paragraphs.
 */

export interface LegalInput {
  businessName: string;
  websiteUrl: string;
  contactEmail: string;
  country: string;
  /** The address people write to. Optional, and genuinely so — a sole trader
   *  working from home should not be pushed into publishing where they live. */
  postalAddress: string;
  collects: {
    contactForm: boolean;
    accounts: boolean;
    payments: boolean;
    analytics: boolean;
    marketingEmail: boolean;
    cookies: boolean;
    shipping: boolean;
  };
  /** Named third parties — the analytics tool, the payment processor. Naming
   *  them is the part most copied policies get wrong, and the part a regulator
   *  or an enterprise customer checks first. */
  processors: string[];
  retentionMonths: number;
  effectiveDate: string;
  /** Terms only. */
  sells: 'goods' | 'services' | 'both' | 'nothing';
  refundDays: number;
}

const list = (items: string[]): string => {
  const clean = items.filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0]!;
  return `${clean.slice(0, -1).join(', ')} and ${clean.at(-1)}`;
};

export function buildPrivacyPolicy(input: LegalInput): string {
  // Capitalised: this lands at the start of a sentence ("… runs this website"),
  // and a generated legal document opening in lower case reads as broken.
  const name = input.businessName || 'This business';
  const site = input.websiteUrl || 'this website';
  const email = input.contactEmail || '[your email address]';
  const c = input.collects;

  const collected: string[] = [];
  if (c.contactForm) collected.push('your name, email address and whatever you write to us');
  if (c.accounts) collected.push('the details you give us when you create an account');
  if (c.payments) collected.push('billing details needed to take a payment');
  if (c.shipping) collected.push('a delivery address, when something has to be sent to you');
  if (c.marketingEmail) collected.push('your email address, if you ask to hear from us');
  if (c.analytics) collected.push('anonymous information about how the site is used');

  const sections: string[] = [];

  sections.push(`# Privacy policy

**${name}**
Effective ${input.effectiveDate}

This explains what information we collect, why, and what you can ask us to do about it. It is written to be read rather than to be long. If anything here is unclear, write to ${email} and we will explain it properly.`);

  sections.push(`## Who we are

${name} runs ${site}${input.country ? `, and operates from ${input.country}` : ''}. ${
    input.postalAddress
      ? `You can write to us at ${input.postalAddress}.`
      : `You can reach us at ${email}.`
  }`);

  sections.push(`## What we collect

${
  collected.length > 0
    ? `We collect ${list(collected)}.`
    : 'We collect almost nothing. If that changes, this page changes with it.'
}

We do not collect anything we do not need, and we do not buy information about you from anybody else.`);

  const uses: string[] = [];
  if (c.contactForm) uses.push('answer you when you get in touch');
  if (c.accounts) uses.push('keep your account working');
  if (c.payments) uses.push('take payment and keep the records our tax authority requires');
  if (c.shipping) uses.push('get your order to the right address');
  if (c.marketingEmail) uses.push('send you the emails you asked for');
  if (c.analytics) uses.push('understand which pages people find useful, so we can improve them');

  sections.push(`## Why we collect it

We use it to ${list(uses) || 'run the site'}. We do not use it for anything else, and we do not sell it. If we ever wanted to use your information for something new, we would ask first.`);

  sections.push(`## Who else sees it

${
  input.processors.filter(Boolean).length > 0
    ? `We use other companies to run parts of this business, and they see the information they need to do their part: ${list(input.processors)}. They are not allowed to use it for anything else.`
    : 'Nobody outside this business, except where we are legally required to hand something over.'
}

We will also share information if a court or the law requires it — and we will tell you if that happens, unless we are forbidden from doing so.`);

  sections.push(`## How long we keep it

${
  input.retentionMonths > 0
    ? `We keep what you send us for about ${input.retentionMonths} months, unless we are legally required to keep it longer — records relating to a payment usually have to be kept for several years for tax reasons.`
    : 'We keep it only for as long as we need it, and no longer.'
}

When we no longer need something, we delete it.`);

  if (c.cookies) {
    sections.push(`## Cookies

A cookie is a small file the site asks your browser to keep. We use them for the things the site cannot work without — remembering you are signed in, keeping what is in your basket${
      c.analytics
        ? ' — and, if you agree, for counting visits so we can see which pages are useful'
        : ''
    }.

You can clear or block cookies in your browser settings. Blocking the essential ones will break parts of the site; blocking the rest will not.`);
  }

  sections.push(`## What you can ask us to do

You can ask us to show you everything we hold about you, to correct anything wrong, or to delete it. You can tell us to stop sending you email at any time, and every marketing email we send has an unsubscribe link in it.

Write to ${email} and we will do it. We will not make you explain why, and we will not charge you.

Depending on where you live you may have further rights under laws such as the GDPR or state privacy legislation, and you may complain to your local data protection authority if you think we have got this wrong.`);

  sections.push(`## Keeping it safe

We take reasonable care: information is held on services that encrypt it, access is limited to people who need it, and we do not keep copies lying around. No one can promise perfect security, and anybody who does is not being straight with you. If something goes wrong in a way that affects you, we will tell you.`);

  sections.push(`## Changes

If we change how any of this works we will update this page and change the date at the top. If the change is significant, we will tell you directly rather than hoping you re-read it.

Last updated ${input.effectiveDate}.`);

  return sections.join('\n\n');
}

export function buildTerms(input: LegalInput): string {
  // Capitalised: this lands at the start of a sentence ("… runs this website"),
  // and a generated legal document opening in lower case reads as broken.
  const name = input.businessName || 'This business';
  const site = input.websiteUrl || 'this website';
  const email = input.contactEmail || '[your email address]';

  const sections: string[] = [];

  sections.push(`# Terms of service

**${name}**
Effective ${input.effectiveDate}

These are the rules for using ${site}${
    input.sells !== 'nothing' ? ' and for buying from us' : ''
  }. By using the site you agree to them. They are short on purpose.`);

  sections.push(`## Using the site

You may use this site for its ordinary purpose. Please do not try to break it, do not attempt to get at other people's information, and do not copy the content and pass it off as your own.

We may change or withdraw parts of the site. We will try not to do that without warning, but we are not promising the site will always be available.`);

  if (input.sells !== 'nothing') {
    const what =
      input.sells === 'goods'
        ? 'goods'
        : input.sells === 'services'
          ? 'services'
          : 'goods and services';

    sections.push(`## Orders and prices

Prices are shown on the site and include or exclude tax as stated at checkout. We do our best to keep prices and descriptions accurate; if something is listed at an obviously wrong price we may cancel the order and refund you rather than honour it.

An order is accepted when we confirm it, not when you place it. If we cannot fulfil something you have paid for, you get your money back.`);

    sections.push(`## Payment

Payment is taken at the time stated at checkout. We do not store your card details${
      input.collects.payments ? ' — our payment processor handles them' : ''
    }.`);

    if (input.refundDays > 0) {
      sections.push(`## Returns and refunds

If you change your mind about ${what} you have bought, tell us within ${input.refundDays} days and we will refund you. Items should come back in the condition they went out in.

This does not affect your legal rights. If something is faulty, not as described, or does not do what we said it would, you are entitled to a remedy regardless of what any policy of ours says — and we would rather sort it out than argue about it.`);
    }

    if (input.sells !== 'goods') {
      sections.push(`## Work we do for you

We will do the work with reasonable care and skill, and within any timescale we have agreed. If something is going to be late we will tell you as soon as we know rather than on the day.

Anything we quote is based on what you told us. If the job turns out to be different, we will talk to you before doing extra work, not afterwards on the invoice.`);
    }
  }

  sections.push(`## When things go wrong

We are responsible for the things a business should be responsible for. We are not responsible for losses we could not reasonably have foreseen, or for problems caused by something outside our control.

Nothing here limits our liability for death or personal injury caused by our negligence, for fraud, or for anything else the law does not allow us to limit.`);

  sections.push(`## Your privacy

How we handle your information is set out in our privacy policy, which forms part of these terms.`);

  sections.push(`## Disagreements

If you are unhappy, write to ${email} first. Almost everything gets sorted out that way, and it is faster for both of us than the alternative.

These terms are governed by the law of ${input.country || '[your country]'}, and any dispute that cannot be settled between us goes to its courts.`);

  sections.push(`## Changes

We may update these terms. The version on the site is the one that applies, and the date at the top tells you when it last changed.

Last updated ${input.effectiveDate}.`);

  return sections.join('\n\n');
}

/** Shown with the output, every time. The tool would be dishonest without it,
 *  and a caveat somebody has to go looking for is not a caveat. */
export const LEGAL_DISCLAIMER =
  'This is a solid starting point, not legal advice. It covers what a straightforward website or shop normally has to disclose. If you handle health information, work with children, trade in several countries with different rules, or do anything unusual with personal data, have a lawyer read it — that is a short conversation, and much cheaper than the alternative.';
