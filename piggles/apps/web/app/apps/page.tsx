import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardBody } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { PIGGLES_GROUPS } from '@piggles/brand';
import { accountUrl, appsInGroup } from '@piggles/config';
import { PageHero } from '@/components/marketing/page-hero';
import { GROUP_COPY } from '@/components/marketing/groups';
import { CloseBand } from '@/components/marketing/close-band';

// /apps — the whole product on one page.
//
// This page's job is the count. Fifteen is a lot to claim and easy to disbelieve
// from a homepage grid, so here every one is named, described in a sentence a
// non-technical owner recognises, and linked to a page of its own. A visitor
// weighing "is this actually enough for my business" should be able to answer it
// here without talking to anybody.
//
// Grouped, never a flat list of fifteen. Six groups is a thing a person can hold
// in their head; fifteen is a thing they scroll past. The groups are also the
// colour system, so this page is where a visitor first learns that amber means
// selling — which is the same thing the rail will teach them on day one.

export const metadata: Metadata = {
  title: 'All fifteen apps',
  description:
    'Everything Piggles includes, grouped the way a business actually works: your website, selling, people, money, and running the place. Every app is in the $49 plan.',
};

export default function AppsIndexPage() {
  return (
    <>
      <PageHero
        heading="Fifteen apps. One subscription. No upgrade buttons."
        lede="Every app below is included from your first day, whether you use one of them or all fifteen. Turning one on changes your workspace, not your bill."
      >
        <a
          className={buttonClasses({ color: 'primary', size: 'lg' })}
          href={accountUrl('signup', 'apps-index')}
        >
          Get Piggles — $49/month
        </a>
        <Link
          className={buttonClasses({ color: 'neutral', variant: 'outline', size: 'lg' })}
          href="/pricing"
        >
          See what changes the price
        </Link>
      </PageHero>

      {PIGGLES_GROUPS.map((group, i) => (
        <section
          key={group}
          data-group={group}
          className={`px-6 py-16 sm:py-20 ${i % 2 === 1 ? 'bg-base-100' : ''}`}
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-3 lg:gap-16">
              <div>
                <h2 className="text-module text-3xl font-extrabold sm:text-4xl">
                  {GROUP_COPY[group].title}
                </h2>
                <p className="mt-4 text-lg">{GROUP_COPY[group].long}</p>
              </div>

              {/* Cards stay on the plain surface and the HUE rides the type.
                  Every card in a section shares one group colour, so tinting
                  them all would render the section as a single coloured block
                  and stop distinguishing anything within it — the tint is a
                  signal, and a signal every element carries is a background. */}
              <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
                {appsInGroup(group).map((app) => (
                  <Card key={app.id}>
                    <CardBody>
                      <h3 className="text-module text-xl font-bold">
                        <Link href={`/apps/${app.id}`}>{app.label}</Link>
                      </h3>
                      <p className="mt-1 text-base">{app.purpose}</p>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>
      ))}

      <CloseBand
        heading="All fifteen, from the first day, for $49 a month."
        primary={{ label: 'Start free for 14 days', href: accountUrl('signup', 'apps-close') }}
        secondary={{ label: 'See what it costs', href: '/pricing' }}
      />
    </>
  );
}
