import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon, Section } from '@piggles/ui';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { accountUrl, APP_BY_ID, appIcon } from '@piggles/config';
import { PRICE_LABEL } from '@piggles/config/pricing';
import { CHANGES, type Change } from '@/content/whats-new';
import { PageHero } from '@/components/marketing/page-hero';
import { CloseBand } from '@/components/marketing/close-band';
import { HeroPanel, HeroPanelBar } from '@/components/marketing/hero/panel';
import { dayWords } from '@/components/marketing/date-words';

// /whats-new: every change in the product, newest first, grouped by month. The
// entries live in content/whats-new.ts; only shipped things go there.

export const metadata: Metadata = {
  title: 'What’s new in Piggles',
  description:
    'Every change to Piggles, newest first, in plain words: what it does for somebody running a business, and which app it is in.',
  alternates: { canonical: '/whats-new' },
};

function monthOf(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

function byMonth(changes: Change[]): [string, Change[]][] {
  const groups = new Map<string, Change[]>();
  for (const c of changes) {
    const key = monthOf(c.date);
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return [...groups.entries()];
}

function AppChip({ app }: { app: Change['app'] }) {
  const def = APP_BY_ID[app];
  if (!def) return null;
  return (
    <Link
      href={`/apps/${app}`}
      data-group={def.group}
      className="ink-module inline-flex items-center gap-2 text-base font-bold"
    >
      <span className="bg-module text-module-content grid size-7 place-items-center rounded-md">
        <Icon glyph={appIcon(app)} aria-hidden className="size-4" />
      </span>
      {def.label}
    </Link>
  );
}

function LatestFigure() {
  return (
    <HeroPanel>
      <HeroPanelBar app="home" title="Most recent" note={dayWords(CHANGES[0]?.date ?? '')} />
      <ul className="divide-base-300 grid divide-y">
        {CHANGES.slice(0, 5).map((c) => (
          <li key={c.title} className="px-5 py-3.5">
            <b className="block text-base font-semibold">{c.title}</b>
            <span className="text-sm">{APP_BY_ID[c.app]?.label}</span>
          </li>
        ))}
      </ul>
    </HeroPanel>
  );
}

export default function WhatsNew() {
  return (
    <>
      <PageHero
        heading="What’s new in Piggles."
        lede="Every change that has shipped, newest first, in the words you would use to describe it. Nothing here is planned or coming soon: if it is on this page, it is in the product today."
        figure={<LatestFigure />}
      >
        <a
          className={buttonClasses({ color: 'primary', size: 'lg' })}
          href={accountUrl('signup', 'whats-new')}
        >
          Start free for 14 days
        </a>
      </PageHero>

      {byMonth(CHANGES).map(([month, changes]) => (
        <Section key={month}>
          <h2 className="text-3xl font-extrabold sm:text-4xl">{month}</h2>
          <ol className="mt-8 grid gap-4">
            {changes.map((c) => (
              <li
                key={`${c.date}-${c.title}`}
                className="bg-base-100 border-base-300 rounded-section grid gap-3 border p-6 sm:grid-cols-[12rem_1fr] sm:gap-8"
              >
                <div className="flex flex-col gap-2">
                  <time dateTime={c.date} className="text-base font-semibold">
                    {dayWords(c.date)}
                  </time>
                  <AppChip app={c.app} />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{c.title}</h3>
                  <p className="mt-2 max-w-[65ch] text-base">{c.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      ))}

      <CloseBand
        heading={`Every change lands in the same ${PRICE_LABEL} a month.`}
        primary={{ label: 'Start free for 14 days', href: accountUrl('signup', 'whats-new-close') }}
        secondary={{ label: 'See every app', href: '/apps' }}
      />
    </>
  );
}
