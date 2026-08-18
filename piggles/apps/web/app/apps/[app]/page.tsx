import type { Metadata } from 'next';
import { Section } from '@piggles/ui';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardBody } from '@wizeworks/silicaui-react';
import { badgeClasses, buttonClasses } from '@wizeworks/silicaui-react/server';
import { accountUrl, APP_BY_ID, APPS, appsInGroup, PRODUCT } from '@piggles/config';
import { APP_MARKETING } from '@/content/apps';
import { PageHero } from '@/components/marketing/page-hero';
import { AppFigure } from '@/components/marketing/hero/app-figure';
import { GROUP_COPY } from '@/components/marketing/groups';
import { CloseBand } from '@/components/marketing/close-band';

// /apps/[app] — one page per app, fifteen of them.
//
// These are the pages the satellite domains point at. pigglescms.com exists to
// catch somebody searching "CMS" — a word this product refuses to use in its own
// interface — and land them somewhere that says "we call it Content, here is what
// it does". That only works if the page genuinely ranks for the technical term,
// which is what `alsoKnownAs` is for, and if it is a real page rather than a
// redirect: a 301 hands the ranking to the destination and leaves the domain
// unable to rank for anything, which defeats the only reason to own it.
//
// So the "also called" block is doing three jobs at once — search, the honest
// translation for a visitor who arrived knowing the jargon, and the product's
// central argument demonstrated rather than claimed. It is the one place on a
// Piggles surface where the technical vocabulary is allowed to appear.
//
// The whole page wears the app's GROUP hue via `data-group`, so the color a
// visitor sees while reading about Stock is the color Stock wears in the rail
// after they sign up.

export function generateStaticParams() {
  return APPS.map((a) => ({ app: a.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ app: string }>;
}): Promise<Metadata> {
  const { app: id } = await params;
  const app = APP_BY_ID[id];
  const copy = APP_MARKETING[id];
  if (!app || !copy) return {};

  return {
    title: app.label,
    // The description carries the jargon deliberately. A search result has to
    // contain the words the searcher used, and "Piggles Stock" is not a phrase
    // anybody has ever typed into a search box.
    description: `${copy.lede} ${PRODUCT.name} calls it ${app.label} — other software calls it ${copy.alsoKnownAs.join(', ')}.`,
  };
}

export default async function AppPage({ params }: { params: Promise<{ app: string }> }) {
  const { app: id } = await params;
  const app = APP_BY_ID[id];
  const copy = APP_MARKETING[id];
  if (!app || !copy) notFound();

  const siblings = appsInGroup(app.group).filter((a) => a.id !== app.id);

  return (
    <div data-group={app.group}>
      <PageHero
        heading={copy.heading}
        lede={copy.lede}
        figure={<AppFigure app={app.id} copy={copy} />}
        assurances={['Free for 14 days', 'No card needed', 'All fifteen apps included']}
      >
        <a
          className={buttonClasses({ color: 'primary', size: 'lg' })}
          href={accountUrl('signup', `app-${app.id}`)}
        >
          Get Piggles — $49/month
        </a>
        <Link className={buttonClasses({ variant: 'outline', size: 'lg' })} href="/apps">
          All fifteen apps
        </Link>
      </PageHero>

      {/* The translation, stated plainly. */}
      <Section>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
          <p className="text-lg">
            Most software calls this <strong>{copy.alsoKnownAs[0]}</strong>. In {PRODUCT.name} it is
            called <span className="ink-module font-bold">{app.label}</span>, because that is what
            you are actually doing.
          </p>
          <ul className="flex flex-wrap gap-2">
            {copy.alsoKnownAs.slice(1).map((term) => (
              <li key={term} className={badgeClasses({ color: 'module', variant: 'soft' })}>
                {term}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section className="bg-base-100 border-base-300 border-y">
        <h2 className="text-3xl font-extrabold sm:text-4xl">What {app.label} does</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {copy.does.map((d) => (
            <Card key={d.title}>
              <CardBody>
                <h3 className="ink-module text-lg font-bold">{d.title}</h3>
                <p className="mt-1 text-base">{d.body}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </Section>

      {copy.photo ? (
        <Section>
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div className="rounded-box border-base-300 overflow-hidden border">
              <Image
                src={copy.photo.src}
                alt={copy.photo.alt}
                width={1600}
                height={1067}
                className="h-full w-full object-cover"
                sizes="(max-width: 1024px) 100vw, 512px"
              />
            </div>
            <div>
              <h2 className="text-3xl font-extrabold sm:text-4xl">
                It is included. All of it, from day one.
              </h2>
              <p className="mt-6 text-lg">
                {app.label} is not an add-on, an upgrade or a thing you pay to unlock and get billed
                for. It is in the $49 plan alongside the other fourteen, whether you open it every
                morning or twice a year.
              </p>
              <Link className={`${buttonClasses({ color: 'success' })} mt-6`} href="/pricing">
                What actually changes the price
              </Link>
            </div>
          </div>
        </Section>
      ) : null}

      <section
        className={`px-6 py-16 sm:py-24 ${copy.photo ? 'bg-base-100 border-base-300 border-t' : ''}`}
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-3 lg:gap-16">
            <div>
              <h2 className="text-3xl font-extrabold sm:text-4xl">Works with the rest of it</h2>
              <p className="mt-6 text-lg">
                Nothing here is a separate product that has been made to talk to the others. They
                are the same business, looked at from different angles.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
              {copy.worksWith.map((otherId) => {
                const other = APP_BY_ID[otherId];
                if (!other) return null;
                return (
                  <Card key={otherId} data-group={other.group}>
                    <CardBody>
                      <h3 className="ink-module text-lg font-bold">
                        <Link href={`/apps/${other.id}`}>{other.label}</Link>
                      </h3>
                      <p className="mt-1 text-base">{other.purpose}</p>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          </div>

          {siblings.length > 0 ? (
            <div className="border-base-300 mt-14 border-t pt-8">
              <p className="text-base">
                <span className="font-bold">{GROUP_COPY[app.group].title}</span> also includes{' '}
                {siblings.map((s, i) => (
                  <span key={s.id}>
                    {i > 0 ? (i === siblings.length - 1 ? ' and ' : ', ') : ''}
                    <Link href={`/apps/${s.id}`} className="ink-module font-semibold">
                      {s.label}
                    </Link>
                  </span>
                ))}
                .
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {/* Every page closes with somewhere to go, and these fifteen most of all:
          they are the landing pages the satellite domains point at, so a visitor
          who arrived here searching "inventory management software" reaches the
          end having read about Stock and needs an offer in front of them. A page
          that ends in the footer sends them back to the search results. */}
      <CloseBand
        heading={`${app.label} is in the $49 plan. So are the other fourteen.`}
        primary={{
          label: 'Start free for 14 days',
          href: accountUrl('signup', `app-${app.id}-close`),
        }}
        secondary={{ label: 'See what it costs', href: '/pricing' }}
      />
    </div>
  );
}
