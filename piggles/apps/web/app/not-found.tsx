import Link from 'next/link';
import { Card, CardBody } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { PIGGLES_GROUPS } from '@piggles/brand';
import { appsInGroup } from '@piggles/config';
import { GROUP_COPY } from '@/components/marketing/groups';

// The 404.
//
// It is a real page rather than the framework default because a 404 is a page
// people genuinely reach — a stale link, a typo, an app renamed — and Next's
// default is the one screen on the site that would look like nothing was
// designed. It also has a job: somebody who landed here was looking for
// something, so the page offers the whole product rather than an apology and a
// dead end.
//
// PLAIN, NOT JOKEY. The mascot earns its keep in empty states and success
// moments; a lost visitor is mildly annoyed, and a pun at that moment reads as
// the software enjoying itself at their expense (piggles/CLAUDE.md RULE #3).

export default function NotFound() {
  return (
    <>
      <section className="bg-base-100 border-base-300 border-b px-6 py-16 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-3 lg:gap-16">
          <h1 className="text-4xl leading-tight font-extrabold sm:text-5xl lg:col-span-2">
            That page isn&rsquo;t here any more.
          </h1>
          <div className="lg:pt-2">
            <p className="text-lg">
              Either the link was old or something moved. Nothing is broken on your side — here is
              everything Piggles does, in case one of them is what you were after.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className={buttonClasses({ color: 'primary', size: 'lg' })} href="/">
                Back to the start
              </Link>
              <Link
                className={buttonClasses({ color: 'neutral', variant: 'outline', size: 'lg' })}
                href="/pricing"
              >
                Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-16 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PIGGLES_GROUPS.map((group) => (
            <Card key={group} data-group={group} className="bg-module bg-soft">
              <CardBody>
                <h2 className="text-module text-xl font-bold">{GROUP_COPY[group].title}</h2>
                <ul className="mt-3 space-y-1">
                  {appsInGroup(group).map((app) => (
                    <li key={app.id}>
                      <Link href={`/apps/${app.id}`} className="text-base font-semibold">
                        {app.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
