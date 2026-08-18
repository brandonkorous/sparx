import type { ReactNode } from 'react';
import { Card, CardBody, Heading, Text } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Display, Section, Spark } from './primitives';
import { HourRow, M } from './staff-hours';
import { Faq, type FaqItem } from './faq';
import { PhotoBand } from './photo-band';
import { StaffClock, StaffFalseFix, StaffRates, StaffTurn } from './staff-sections';
import { StaffCapabilities, StaffHandoff, StaffJobs, StaffWages, StaffWeek } from './staff-work';
import { signupHref } from './cta';

/**
 * The /staff marketing page.
 *
 * THE PAGE TELLS ONE STORY, in the six beats the voice doc specifies
 * (docs/brain/design/voice.md; /crm is the worked example). Read the headlines
 * in order — if they shuffle without loss it is a feature inventory, and this
 * module would have been an easy one to inventory: a roster, a timesheet, a
 * rota, a leave queue and a licence tracker are five screens with no argument
 * between them.
 *
 *   1. PROMISE ......... hero — you know what you paid them; this is what an
 *                        hour of their time actually costs you
 *   2. RECOGNITION ..... you quoted the job off a number you carry in your head
 *   3. FALSE FIX ....... so you run payroll, and it is RIGHT, and it still has
 *                        never heard of a job
 *   4. THE TURN ........ an hour isn't a cost until you know the rate that day
 *                        AND the work it went on — we hold the job    ← LAYER 5
 *   5. CONSEQUENCES .... it records → it prices (and refuses to guess) → the
 *                        wages line stops being typed → the jobs get ranked.
 *                        The chain escalates from a four-second entry to
 *                        knowing which work paid for itself, so the order is
 *                        load-bearing
 *   6. RESOLUTION ...... payroll stays exactly where it is (closes beat 3),
 *                        then the week, the capabilities, the price, the ask
 *
 * THE HARD CONSTRAINT ON EVERY WORD HERE is docs/149 §1: this is not payroll and
 * never becomes it. No line may imply withholding, filing, benefits, or paying
 * anybody, and nothing claims to replace a payroll bureau — the pricing page's
 * own "replaces" line says a scheduling and time-clock app, deliberately.
 * Beat 3 concedes the payroll run is correct and beat 6 hands it back, which is
 * both the honest position and the more persuasive one.
 *
 * Staff brown is a signal everywhere except beat 4, which paints it — one
 * identity band per page (DESIGN.md §2.5). Layers present: 1 (the FAQ's bare
 * section), 2, 3, 4 (the pricing band) and 5 (the turn).
 *
 * Every figure reconciles across every section. The two wage totals differ on
 * purpose and the page says why — see the note atop staff-work.tsx.
 */
export function StaffPage() {
  return (
    <>
      <StaffHero />
      {/* BEAT 2 — RECOGNITION. The reader is not careless; they are quoting from
          a number they have carried for years and never checked. A photograph
          carries it because the subject is people mid-work — the exact moment
          the cost is being incurred and not recorded. */}
      <PhotoBand
        surface="surface"
        accent={M.ink}
        side="right"
        src="/scenes/craft-bench.jpg"
        alt="Two makers working together at a studio bench, mid-project."
        headline="You quote off a number you’ve carried for years"
        lede="Call it forty an hour, near enough. It was near enough once. Since then somebody had a raise, your insurance went up, and one job in five takes half a day longer than the one you priced it against — and none of that announced itself. It just quietly came out of what you kept."
      />
      {/* BEAT 3 — THE FALSE FIX. Concede that payroll is correct, then attack
          the grain. The concession is what makes beat 4 credible. */}
      <StaffFalseFix />
      {/* BEAT 4 — THE TURN. Layer 5: the module's own hue, painted, at the one
          moment the page says the thing only sparx can say. */}
      <StaffTurn />
      {/* BEAT 5 — CONSEQUENCES. Four sections that each follow from the turn:
          it records → it prices → the wages line arrives → the jobs get ranked. */}
      <StaffClock />
      <StaffRates />
      <StaffWages />
      <StaffJobs />
      {/* BEAT 6 — RESOLUTION. Closes the loop opened in beat 3: the payroll run
          was right, and it stays with whoever runs it. Side flipped so the two
          photo bands never stack into the same silhouette. */}
      <PhotoBand
        surface="surface"
        accent={M.ink}
        side="left"
        src="/scenes/workshop-plans.jpg"
        alt="Two people leaning over drawings spread across a workbench, working something out together."
        headline="Then quote the next one off a real number"
        lede="Not a feeling about how long that kind of job takes — the hours the last four actually took, at what they actually cost. The estimate stops being the thing you are most nervous about, and the job that always ran long stops being the one you keep taking."
      />
      <StaffHandoff />
      <StaffWeek />
      <StaffCapabilities />
      <StaffProof />
      <StaffPricing />
      <Faq
        items={STAFF_FAQ}
        id="faq"
        heading={
          <>
            Team questions
            <Spark color={M.ink} />
          </>
        }
        lede="What it does, what it deliberately doesn’t, and what it costs — answered straight. Fourteen days free, and we don’t ask for a card."
      />
      <StaffCta />
    </>
  );
}

// ── HERO (BEAT 1 · PROMISE) ──────────────────────────────────────────────────
//
// The device is one hour of one person's time, taken apart. It earns its place
// three ways: it is the promise stated as a picture, it teaches the burden idea
// in the first screenful so every later figure can be a burdened one without
// re-explaining itself, and it is a sum nobody can do from a payroll report —
// which is the argument the whole page makes.

function StaffHero() {
  return (
    <Section padding="xl">
      <div className="grid grid-cols-1 items-center gap-[clamp(40px,6vw,72px)] lg:grid-cols-[1.05fr_1fr]">
        <div className="min-w-0">
          <Display as="h1" size={84} lineHeight={80}>
            What an hour{' '}
            <span>
              actually costs
              <Spark color={M.ink} />
            </span>
          </Display>
          <Text variant="lead" className="mt-7 max-w-[600px]">
            For most businesses that do work rather than ship boxes, wages are the biggest number on
            the page and the one nobody can break down. sparx records who worked, for how long, on
            what, and at what rate — then turns it into a real figure instead of a line you type in
            and hope. It is not payroll, and it never will be.
          </Text>
          <div className="mt-[34px] flex flex-wrap items-center gap-3">
            <a
              href={signupHref('staff-hero')}
              className={buttonClasses({ color: 'module-staff', size: 'xl' })}
            >
              Start free →
            </a>
            <a href="#by-job" className={buttonClasses({ size: 'xl', variant: 'outline' })}>
              See it cost a job
            </a>
          </div>
          <Text className="mt-[22px] font-mono">
            $29/mo flat · however many people · 14 days free, no card
          </Text>
        </div>

        <div className="w-full min-w-0">
          <Card>
            <CardBody className="gap-5">
              <div className="flex items-baseline justify-between gap-4">
                <Heading level={3} size={4}>
                  One hour of Dave’s time
                </Heading>
                <Text as="span" className="font-mono">
                  Ridgeline Service
                </Text>
              </div>

              <div className="flex flex-col">
                <HourRow who="On the payslip" detail="his hourly wage" cost="$28.00" />
                <HourRow who="Employer costs" detail="22% — tax, comp, insurance" cost="+ $6.16" />
              </div>

              <div className="border-base-300 border-t pt-2">
                <HourRow who="What it costs you" cost="$34.16" emphasis />
              </div>

              <div className="border-base-300 flex flex-col gap-2 border-t pt-5">
                <HourRow
                  who="× 8 hours on the Ellison job"
                  detail="one of three people who worked it"
                  cost="$273.28"
                />
                <Text className="text-sm">
                  Against a $1,240 invoice. Nobody at Ridgeline could have told you that number
                  before, because it was never written down anywhere it could be added up.
                </Text>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </Section>
  );
}

// ── DARK PROOF ───────────────────────────────────────────────────────────────
function StaffProof() {
  const stats: { n: ReactNode; l: string }[] = [
    {
      n: <>1{<Spark color={M.ink} />}</>,
      l: 'place the hours and the job both live — labour cost is read, never estimated',
    },
    { n: '$29', l: 'a month, flat, whether you have three people or thirty · never per seat' },
    { n: '0', l: 'logins required · the tech who never opens sparx still has hours and a rate' },
    { n: '2', l: 'records per shift — what you rostered, and what actually happened' },
  ];
  return (
    <Section surface="dark" padding="lg">
      <div className="max-w-[760px]">
        <Display size={46} lineHeight={48}>
          What that adds up to
          <Spark color={M.ink} />
        </Display>
        <Text variant="lead" className="mt-6 max-w-[640px]">
          No per-person charge, nothing metered by how many hours you record, and no separate bill
          for the people who never sign in. Four numbers worth knowing before you look at the one
          that matters.
        </Text>
      </div>
      <div className="mt-14 grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.l} className={i === 0 ? undefined : 'border-base-300 border-l pl-8'}>
            <div className="font-sans text-[clamp(36px,5vw,54px)] leading-none font-medium tracking-[-0.03em]">
              {s.n}
            </div>
            <Text className="mt-3 text-sm">{s.l}</Text>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── PRICING STRIP (LAYER 4) ──────────────────────────────────────────────────
//
// A PAINTED band — the ask, in the brand's own color. EMBER IS A DISPLAY
// GROUND, NOT A READING GROUND: measured, `primary` runs 4.13:1, which clears
// WCAG's large-text bar (3.0) and fails the body bar (4.5). So nothing here is
// smaller than `text-2xl` (24px) unless it is a solid control painting its own
// foreground. Same constraint and same reasoning as /finance and /crm.
//
// The control is SOLID `neutral`: a painted band is a fill, not a theme scope,
// so an outline or ghost button would ink itself from the light theme.
function StaffPricing() {
  return (
    <Section surface="primary" padding="lg">
      <div className="flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-center">
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-[clamp(56px,7vw,80px)] leading-none font-medium tracking-[-0.03em]">
              $29
            </span>
            <span className="text-2xl">/mo — for everybody</span>
          </div>
          <p className="max-w-[660px] text-2xl leading-[1.4]">
            Flat, whether you have three people or thirty. Not per seat, because charging by the
            head would put a price on the exact thing this module is for. Free for fourteen days,
            and we don’t ask for a card.
          </p>
        </div>
        <a
          href={signupHref('staff-pricing')}
          className={buttonClasses({ color: 'neutral', size: 'xl' })}
        >
          Switch Team on →
        </a>
      </div>
    </Section>
  );
}

// ── FINAL CTA (dark) ─────────────────────────────────────────────────────────
function StaffCta() {
  return (
    <Section surface="dark" padding="xl">
      <div className="flex flex-col items-start gap-9">
        <Display size={88} lineHeight={84}>
          Find out what the work actually took
          <Spark color={M.ink} />
        </Display>
        <Text variant="lead" className="m-0 max-w-[660px]">
          Fourteen days free, no card, and no contract at the end of it. Turn it off the day it
          stops earning its $29 and every hour, rate and record you entered stays yours — exportable
          in full, from a button, without asking anyone.
        </Text>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={signupHref('staff-final')}
            className={buttonClasses({ color: 'module-staff', size: 'xl' })}
          >
            Start free →
          </a>
          <a href="#payroll" className={buttonClasses({ size: 'xl', variant: 'outline' })}>
            What about payroll?
          </a>
        </div>
      </div>
    </Section>
  );
}

// Page-specific FAQ — real evaluation questions, answered straight and grounded
// in docs/149 and in what actually shipped. Feeds the FAQPage JSON-LD via <Faq>,
// so accuracy is load-bearing: an assistant quotes these verbatim, which makes
// the payroll boundary and the shape of the export the two answers that must not
// drift.
const STAFF_FAQ: FaqItem[] = [
  {
    id: 'staff-not-payroll',
    question: 'Is this payroll? Does it replace my payroll provider?',
    answer:
      'No, and it is not going to. sparx does not withhold tax, does not file anything with anybody, does not administer benefits, and never pays a person. That boundary is permanent, not a version-one cut — becoming a tax filer in fifty states is a different company, and the people who already do it have spent a decade earning the trust it takes. What sparx does is the part your payroll provider cannot: record what people worked, on which job, at what it cost you, and hand the hours over so payroll can do its job accurately.',
  },
  {
    id: 'staff-price',
    question: 'How much does it cost, and is it per person?',
    answer:
      'A flat $29 a month, whether you have three people on the books or thirty. It is deliberately not per seat: this module exists to tell you what your people cost, and pricing it by the head would mean charging you more for the exact thing it measures. There is no charge for someone who never signs in, and most of the people on a roster never do.',
  },
  {
    id: 'staff-finance',
    question: 'Do I need the Finance module too?',
    answer:
      'No. They are two separate $29 modules and neither includes the other. Team on its own gives you hours, pay rates, rotas, time off and licence renewals, and tells you what a period of work cost. What Finance adds is everything else — parts, rent, fuel, subscriptions — so it can show you profit and rank your jobs by what you kept. Run both and the wages figure in Finance is derived from real hours instead of typed in. Run either alone and it is still useful.',
  },
  {
    id: 'staff-what-if-no-rate',
    question: 'What happens to hours for someone whose pay rate I haven’t entered?',
    answer:
      'They are counted and reported as unpriced, never costed at zero. The timesheet says how many hours cannot be priced, the period total is labelled as partial rather than final, and the wage cost filed against your spending is short by exactly that much and says so. This matters more than it sounds: a zero in a labour column becomes a zero in a profit figure, and an owner reads that as a fortnight where the work was free. Add the rate afterwards, dated from their first day, and the period prices itself — nobody else’s figures move, because everyone else’s rates were already the rates in force.',
  },
  {
    id: 'staff-raise',
    question: 'What happens to old jobs when somebody gets a raise?',
    answer:
      'Nothing, and that is the whole design. A pay rate here is a row with a start date rather than a field on the person: give somebody a new rate and the old one closes the day before it begins, so an hour worked in March is still costed at March’s rate. Systems that store the rate on the person rewrite the cost of every job that person has ever touched the moment you edit it — which is how last quarter’s profit moves for a reason nobody can explain.',
  },
  {
    id: 'staff-clock',
    question: 'Do people have to clock in? What if they won’t?',
    answer:
      'They don’t have to. A duration typed in afterwards — “3.5 hours on the Ellison job” — is a first-class entry here, not a workaround, because that is genuinely how a lot of people work. Clocking in from a phone is there for the teams that prefer it, and a bulk import is there for the fortnight you are catching up on. All three become the same record, so nothing downstream cares which it was. What all three do need is the job, and that is one tap.',
  },
  {
    id: 'staff-payroll-export',
    question: 'How do the hours get to whoever runs my payroll?',
    answer:
      'You download a file of any period: every approved hour per person, in decimal hours, with their id in your payroll system on the row so nobody is matching names in a spreadsheet. Any payroll package or bureau takes that. Hours that could not be costed are on it too, flagged separately — they still have to be paid, and leaving them off a payroll file would underpay a real person. There is no direct connection to a payroll provider today and none is implied anywhere in the product.',
  },
  {
    id: 'staff-contractors',
    question: 'Can I use it for contractors and volunteers, not just employees?',
    answer:
      'Yes. Each person is recorded as an employee, a contractor or a volunteer, and that is purely a cost-reporting distinction — sparx does not decide anybody’s employment status, does not file anything based on it, and never presents it as though it did. A volunteer or an owner who does not take a wage is recorded as unpaid, which means their hours cost nothing. That is a real answer and it reads differently from “nobody has told us what this person earns”, which is the one the platform refuses to guess at.',
  },
];
