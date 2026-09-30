import type { Metadata } from 'next';
import Link from 'next/link';
import { FaqSection, Icon, Section } from '@piggles/ui';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { accountUrl, APPS, appIcon, type PigglesAppId } from '@piggles/config';
import { APP_MARKETING } from '@/content/apps';
import { PageHero } from '@/components/marketing/page-hero';
import { CloseBand } from '@/components/marketing/close-band';
import { FaqJsonLd } from '@/components/marketing/faq-jsonld';
import { HeroPanel, HeroPanelBar } from '@/components/marketing/hero/panel';

// /what-connects: every outside service a Piggles customer can connect TODAY.
//
// DERIVED from the `connects` lists on the app pages (content/apps), which are
// held to the rule that a name appears only when it can be connected now. So
// this page cannot name a service the app pages do not, and adding one to an
// app page adds it here. The "not yet" list is the other half of the same
// honesty: the names people ask about that do NOT connect, checked in the
// deploy config on 2026-09-30 (piggles/docs/marketing/HANDOFF-2026-09-30.md §3).

export const metadata: Metadata = {
  title: 'What Piggles connects to',
  description:
    'Every service Piggles connects to today: Stripe, PayPal, Square and other payment companies, Shippo, Google Search Console, seven social networks, dropshipping suppliers, and Claude, ChatGPT or your own AI account. Plus what does not connect yet.',
  alternates: { canonical: '/what-connects' },
};

interface AppConnections {
  app: PigglesAppId;
  names: string[];
}

function connectionsByApp(): AppConnections[] {
  return APPS.flatMap((def) => {
    const page = APP_MARKETING[def.id];
    const names = [...new Set((page?.chapters ?? []).flatMap((c) => c.connects ?? []))];
    return names.length ? [{ app: def.id, names }] : [];
  });
}

const OWN_TOOLS = [
  {
    title: 'Send word to another tool',
    body: 'When an order is paid, a form is filled in, a page is published or stock runs low, Piggles can send a message to another tool’s web address, and show whether it arrived.',
  },
  {
    title: 'A key for your own software',
    body: 'Give your own tools a key that reaches only what you allow, and take it back whenever you like.',
  },
  {
    title: 'Spreadsheets in and out',
    body: 'Customers, products, stock, orders, invoices, bookings and articles download as spreadsheets, and Move in reads spreadsheets from almost anywhere.',
  },
];

const NOT_YET = [
  {
    name: 'QuickBooks and Xero',
    body: 'Not connected. Money shows what came in and went out; your accountant’s own software is still where the books are kept.',
  },
  {
    name: 'Amazon, eBay, Etsy, Walmart and other marketplaces',
    body: 'Piggles does not list your products on marketplaces. Etsy listings and sold orders can be moved in from Etsy’s own export files.',
  },
  {
    name: 'Pinterest',
    body: 'Not available to customers yet.',
  },
  {
    name: 'Text messages',
    body: 'Piggles does not send text messages. Reminders and messages go by email and live chat.',
  },
  {
    name: 'X (formerly Twitter)',
    body: 'Posting to X is not available.',
  },
];

const QUESTIONS = [
  {
    q: 'Does Piggles work with QuickBooks?',
    a: 'Not today. Money in Piggles shows what came in, what went out and what you kept, but it is not accounting software and does not send anything to QuickBooks or Xero. Keep your accountant’s own software for the books.',
  },
  {
    q: 'Which payment companies can I use?',
    a: 'Stripe, PayPal, Square, Authorize.net and 1stPayGateway. Piggles adds no fee of its own to a sale; the payment company charges its own card fee.',
  },
  {
    q: 'Can I use ChatGPT or Claude with my Piggles data?',
    a: 'Yes. Connect Claude, ChatGPT or Copilot to Piggles and it can read and act on only what you allow. Or connect your own Anthropic or OpenAI account for the AI features inside Piggles, and the bill for what it does goes to them. Piggles never uses your data to train AI.',
  },
  {
    q: 'Which social networks can Piggles post to?',
    a: 'Facebook Pages, Instagram, LinkedIn, your Google Business Profile, TikTok, YouTube and Threads.',
  },
];

function ConnectsFigure({ groups }: { groups: AppConnections[] }) {
  return (
    <HeroPanel>
      <HeroPanelBar app="connections" title="Connections" note="Connect today" />
      <ul className="flex flex-wrap gap-2 p-5">
        {[...new Set(groups.flatMap((g) => g.names))].map((name) => (
          <li
            key={name}
            className="border-base-300 rounded-field border px-3 py-1.5 text-base font-semibold"
          >
            {name}
          </li>
        ))}
      </ul>
    </HeroPanel>
  );
}

export default function WhatConnects() {
  const groups = connectionsByApp();
  return (
    <>
      <FaqJsonLd path="/what-connects" name="What Piggles connects to" items={QUESTIONS} />
      <PageHero
        heading="What Piggles connects to, and what it does not."
        lede="Every name on this page can be connected by a Piggles customer today. Nothing planned, nothing behind a waiting list. The things people ask about that do not connect are listed too, in the same words."
        figure={<ConnectsFigure groups={groups} />}
      >
        <a
          className={buttonClasses({ color: 'primary', size: 'lg' })}
          href={accountUrl('signup', 'what-connects')}
        >
          Start free for 14 days
        </a>
        <Link className={buttonClasses({ variant: 'outline', size: 'lg' })} href="#not-yet">
          What does not connect
        </Link>
      </PageHero>

      <Section>
        <h2 className="text-3xl font-extrabold sm:text-4xl">By the app they work with</h2>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => {
            const def = APPS.find((a) => a.id === g.app);
            if (!def) return null;
            return (
              <li
                key={g.app}
                data-group={def.group}
                className="bg-base-100 border-base-300 rounded-section border p-6"
              >
                <Link
                  href={`/apps/${g.app}`}
                  className="ink-module inline-flex items-center gap-2 text-xl font-bold"
                >
                  <span className="bg-module text-module-content grid size-8 place-items-center rounded-md">
                    <Icon glyph={appIcon(g.app)} aria-hidden className="size-4" />
                  </span>
                  {def.label}
                </Link>
                <p className="mt-3 text-base">{g.names.join(', ')}</p>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section variant="panel" className="bg-base-100 shadow">
        <h2 className="text-3xl font-extrabold sm:text-4xl">Your own tools</h2>
        <div className="mt-10 grid gap-8 lg:grid-cols-3">
          {OWN_TOOLS.map((t) => (
            <div key={t.title}>
              <h3 className="text-xl font-bold">{t.title}</h3>
              <p className="mt-2 text-base">{t.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="not-yet">
        <h2 className="text-3xl font-extrabold sm:text-4xl">What does not connect</h2>
        <p className="mt-4 max-w-[60ch] text-lg">
          The names people ask about most that Piggles does not connect to today. If one of these is
          essential to how you work, it is better to know now.
        </p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {NOT_YET.map((n) => (
            <li key={n.name} className="border-base-300 rounded-section border p-6">
              <h3 className="text-xl font-bold">{n.name}</h3>
              <p className="mt-2 text-base">{n.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <FaqSection heading="Questions about connections" items={QUESTIONS} />

      <CloseBand
        heading="Connect what you use. Everything else is already inside."
        primary={{
          label: 'Start free for 14 days',
          href: accountUrl('signup', 'what-connects-close'),
        }}
        secondary={{ label: 'See every app', href: '/apps' }}
      />
    </>
  );
}
