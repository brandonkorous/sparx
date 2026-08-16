import type { Metadata } from 'next';
import { Section } from '@piggles/ui';
import Link from 'next/link';
import { Card, CardBody } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { PIGGLES_GROUPS, type PigglesGroup } from '@piggles/brand';
import { accountUrl, appsInGroup } from '@piggles/config';
import { PageHero } from '@/components/marketing/page-hero';
import { GROUP_COPY } from '@/components/marketing/groups';
import { CloseBand } from '@/components/marketing/close-band';

// /how-it-works — the destination behind the home page's onboarding section.
//
// ── WHY THIS PAGE HAD TO EXIST ──────────────────────────────────────────────
//
// "You answer two questions. It arrives set up." was 202 words on the home page
// with nowhere to click. It is also the single claim on that page most likely to
// be disbelieved: everybody has been told a product sets itself up, and everybody
// has then been handed an empty screen and a help centre. A claim that big needs
// somewhere to be checked, and the home page is not the place to check it — it
// gets three seconds and a link, and this is what the link owes it.
//
// ── WHAT IT IS ALLOWED TO SAY ───────────────────────────────────────────────
//
// Everything here is something the account app genuinely does today. The section
// this page came from carried the same restraint (STATUS.md, "Onboarding") and it
// matters more here, because a page titled "how it works" that describes a flow
// nobody has built is the exact thing DESIGN.md §10 exists to stop. If a step
// changes in the account app, this page is wrong until it is edited — there is no
// mechanism keeping them in step and pretending otherwise would be worse.
//
// ── THE SHAPE ───────────────────────────────────────────────────────────────
//
//   1  The two questions — the whole form, shown
//   2  What "arrives set up" means, per group
//   3  What the answer does NOT do
//   4  The fourteen days

export const metadata: Metadata = {
  title: 'How getting started works',
  description:
    'Two questions at signup, and a workspace that is already set up when you arrive. What Piggles fills in for you, what your answer changes, and what the first fourteen days are.',
};

/** Which groups the depicted signup has ticked. Three of six, because the answer
 *  sets what you SEE first and never what you are allowed to have. */
const PICKED: PigglesGroup[] = ['web', 'people', 'money'];

/** What is already in each group when the workspace opens. The claim this whole
 *  page rests on, so each line is a thing that is genuinely there rather than a
 *  thing that could be. */
const ARRIVES: Record<PigglesGroup, string> = {
  home: 'A screen that already knows what to show you first, arranged around the apps you said you wanted.',
  web: 'A real website with your business name on it, live on a Piggles address, with pages you can edit rather than a blank canvas.',
  sell: 'Tax, postage and a currency already set for where you are, so the first product you add is sellable.',
  people:
    'A customer list with a pipeline in it and the stages a small business actually uses, not an empty database.',
  money:
    'Your accounts, your invoice numbering and a template with your name on it — ready to send the first one.',
  run: 'You, as the owner, with access to everything, and the settings a second person will need on the day you hire them.',
};

const NOT_LOCKED = [
  {
    title: 'What you didn’t pick is already there',
    body: 'Nothing was withheld and nothing is off. The apps you did not choose are out of your way rather than out of your reach, and putting one back in front of you takes a tap and costs nothing.',
  },
  {
    title: 'You can change your mind on Tuesday',
    body: 'The answer sets what you see first, not what you are allowed to have. Nothing you choose at signup is a door you have to pay to reopen later.',
  },
  {
    title: 'Nothing has to be undone first',
    body: 'Showing one later does not reset anything or start you over. It has been sitting there the whole time with your business already in it — the customers, the products and the numbers it needs are the ones you have been using.',
  },
];

const DAYS = [
  {
    title: 'No card, at all',
    body: 'Not held, not authorised, not asked for. There is nothing to cancel if you decide it is not for you — the trial simply ends.',
  },
  {
    title: 'All fifteen apps, the whole time',
    body: 'A trial is not a smaller Piggles. Nothing is withheld to be sold to you later, because there is nothing above the one plan to sell.',
  },
  {
    title: 'Real work, kept',
    body: 'The website you build, the customers you add and the invoices you send during the trial are yours. Carrying on does not mean starting again.',
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        heading="Two questions, and then a business that already works."
        lede="Fifteen apps is a lot to look at and nothing to set up. Signing up asks what the business is called and what you want to start with — and everything below is already done by the time you get there."
      >
        <a
          className={buttonClasses({ color: 'primary', size: 'lg' })}
          href={accountUrl('signup', 'how-it-works')}
        >
          Start free for 14 days
        </a>
        <Link className={buttonClasses({ variant: 'outline', size: 'lg' })} href="/apps">
          See all fifteen apps
        </Link>
      </PageHero>

      {/* ── 1 · THE WHOLE FORM ─────────────────────────────────────────────── */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-start lg:gap-16">
          <div>
            <h2 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">
              This is the entire form.
            </h2>
            <p className="mt-6 max-w-[58ch] text-lg">
              Not the first step of the form. There is no second page, no card, no company size, no
              &ldquo;how did you hear about us&rdquo;, and nobody rings you. The second question is
              the only one that changes anything, and it changes what you see — never what you are
              allowed to have.
            </p>
          </div>
          {/* The SIGNUP, not the console — the same depiction the home page used
              to carry, moved here whole rather than summarised. A shorter version
              of a screenshot is just a less accurate screenshot. */}
          <Card className="lg:sticky lg:top-24">
            <CardBody>
              <p className="text-base font-bold">Signing up</p>

              <p className="mt-6 text-base font-semibold">What is the business called?</p>
              <p className="bg-base-200 border-base-300 rounded-field mt-2.5 border px-4 py-4 text-lg">
                Wildroot Flowers
              </p>

              <p className="mt-7 text-base font-semibold">What do you want to start with?</p>
              <ul className="mt-2.5 flex flex-wrap gap-2.5">
                {PIGGLES_GROUPS.map((group) => {
                  const on = PICKED.includes(group);
                  return (
                    <li
                      key={group}
                      data-group={group}
                      className={`rounded-field border px-4 py-3 text-base font-semibold ${
                        on
                          ? 'bg-module bg-soft border-module text-module'
                          : 'bg-base-100 border-base-300'
                      }`}
                    >
                      {GROUP_COPY[group].title}
                    </li>
                  );
                })}
              </ul>

              <p className="mt-7 text-base font-semibold">
                That is the whole form. No card, free for fourteen days.
              </p>
            </CardBody>
          </Card>
        </div>
      </Section>

      {/* ── 2 · WHAT ARRIVES ───────────────────────────────────────────────── */}
      <Section className="bg-base-100 border-base-300 border-y">
        <h2 className="max-w-[26ch] text-3xl font-extrabold sm:text-4xl lg:text-5xl">
          It is all there, and it is all ready.
        </h2>
        <p className="mt-6 max-w-[62ch] text-lg">
          Opening something for the first time should not mean an empty screen and a manual. Here is
          what is already in each part of the workspace the first time you look at it.
        </p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PIGGLES_GROUPS.map((group) => (
            <li
              key={group}
              data-group={group}
              className="bg-module bg-soft border-base-300 rounded-section border p-6 sm:p-8"
            >
              <h3 className="text-module font-heading text-xl font-black sm:text-2xl">
                {GROUP_COPY[group].title}
              </h3>
              <p className="mt-2.5 text-base">{ARRIVES[group]}</p>
              <p className="mt-4 text-base font-semibold">
                {appsInGroup(group)
                  .map((a) => a.label)
                  .join(' · ')}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── 3 · WHAT THE ANSWER DOES NOT DO ────────────────────────────────── */}
      <Section>
        <h2 className="max-w-[26ch] text-3xl font-extrabold sm:text-4xl lg:text-5xl">
          The question you answer is not a plan you are on.
        </h2>
        <ul className="mt-10 grid gap-8 sm:grid-cols-3 lg:gap-10">
          {NOT_LOCKED.map((n) => (
            <li key={n.title} className="border-base-content border-t-2 pt-5">
              <h3 className="text-xl font-bold">{n.title}</h3>
              <p className="mt-2 text-base">{n.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── 4 · THE FOURTEEN DAYS ──────────────────────────────────────────── */}
      <Section className="bg-base-100 border-base-300 border-y">
        <h2 className="max-w-[26ch] text-3xl font-extrabold sm:text-4xl lg:text-5xl">
          Then fourteen days that are actually fourteen days.
        </h2>
        <ul className="mt-10 grid gap-8 sm:grid-cols-3 lg:gap-10">
          {DAYS.map((d) => (
            <li key={d.title} className="border-base-content border-t-2 pt-5">
              <h3 className="text-xl font-bold">{d.title}</h3>
              <p className="mt-2 text-base">{d.body}</p>
            </li>
          ))}
        </ul>
        <Link
          className={`${buttonClasses({ color: 'success', size: 'lg' })} mt-10`}
          href="/pricing"
        >
          What happens after the fourteen days
        </Link>
      </Section>

      <CloseBand
        heading="Two questions is the whole of it. Go and see."
        primary={{ label: 'Start free for 14 days', href: accountUrl('signup', 'how-close') }}
        secondary={{ label: 'See what it costs', href: '/pricing' }}
      />
    </>
  );
}
