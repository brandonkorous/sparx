import Link from 'next/link';
import { Section } from '@piggles/ui';
import { Card, CardBody } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { PIGGLES_GROUPS } from '@piggles/brand';
import { appsInGroup } from '@piggles/config';
import { PageHero } from '@/components/marketing/page-hero';
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
      {/* On <PageHero> like every other page. It carried a hand-built copy of
          the OLD hero — `bg-base-100`, a hairline, the 2/1 column split — which
          went on looking like the rest of the site right up until the rest of
          the site changed. A duplicated layout only stays consistent until
          somebody edits the original.

          NO figure, deliberately. The lede points at the six group cards below
          ("here is everything Piggles does"), and a wall of the same fifteen
          apps in the fold would be answering the sentence before it finishes. */}
      <PageHero
        heading="That page isn’t here any more."
        lede="Either the link was old or something moved. Nothing is broken on your side — here is everything Piggles does, in case one of them is what you were after."
      >
        <Link className={buttonClasses({ color: 'primary', size: 'lg' })} href="/">
          Back to the start
        </Link>
        <Link className={buttonClasses({ variant: 'outline', size: 'lg' })} href="/pricing">
          Pricing
        </Link>
      </PageHero>

      <Section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PIGGLES_GROUPS.map((group) => (
            <Card key={group} data-group={group} className="bg-module bg-soft">
              <CardBody>
                <h2 className="ink-module text-xl font-bold">{GROUP_COPY[group].title}</h2>
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
      </Section>
    </>
  );
}
