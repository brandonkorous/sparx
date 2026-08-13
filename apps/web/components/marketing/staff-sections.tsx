import { Badge, Card, CardBody, Heading, Text } from '@wizeworks/silicaui-react';
import { Section, SectionHeader } from './primitives';
import { HourRow, HourState, M, Unpriced } from './staff-hours';

/**
 * /staff, beats 3 and 4 — the false fix and the turn — plus the first two
 * consequences (it records the hour, it prices the hour). The rest of the chain
 * and the resolution live in `staff-work.tsx`; the page shell and its story map
 * are in `staff-page.tsx`.
 *
 * ONE WORKED EXAMPLE runs through every device on this page: Ridgeline Service,
 * a nine-person vehicle workshop, in March. Gross wages $18,470, which costs the
 * business $22,533.40 once the 22% employer costs are on. Three people and 14.5
 * hours on the Ellison job; 26 hours on the Farrow rebuild. Every figure in
 * every section reconciles to those, deliberately — a page arguing that your
 * labour numbers do not add up cannot afford to have numbers that do not add up.
 * The two wage totals differ ON PURPOSE and staff-work.tsx says why out loud.
 *
 * THE HARD CONSTRAINT ON EVERY WORD HERE (docs/149 §1): this is not payroll and
 * never will be. Nothing on this page may imply withholding, filing, benefits,
 * or paying anybody, and nothing claims to replace a payroll bureau — beat 3
 * concedes the payroll report is RIGHT, and beat 6 hands it back. Implying
 * otherwise would be the one sentence that makes an owner distrust the rest.
 */

// ── BEAT 3 · THE FALSE FIX ───────────────────────────────────────────────────
//
// The move is NOT "your payroll system is bad". It is that the payroll run is
// exactly right and still cannot answer the question, because it has never
// heard of a job. Conceding the total first is what buys the turn its
// credibility — and it is also simply true, which is the more important reason.

/** What the payroll run knows: gross pay, per person, for the fortnight. All
 *  correct, and all at the wrong grain. */
const PAYROLL: { label: string; value: string }[] = [
  { label: 'Dave Okonjo', value: '$2,240.00' },
  { label: 'Marta Reyes', value: '$2,080.00' },
  { label: 'Sam Whitfield', value: '$1,760.00' },
  { label: 'Priya Raman', value: '$2,400.00' },
  { label: 'Five others', value: '$8,110.00' },
];

export function StaffFalseFix() {
  return (
    <Section id="the-question" padding="lg">
      <div className="max-w-[820px]">
        <SectionHeader
          headline={<>Your payroll report is correct. It still can’t tell you what Tuesday cost.</>}
          lede={
            <>
              Not because it is bad at its job — because its job is a different one. Payroll exists
              to pay people accurately and file what has to be filed, and it does that. Then you ask
              the question you actually had, and it has nothing to answer with, because it has never
              heard of a job.
            </>
          }
        />
      </div>

      <div className="mt-14 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {/* What payroll knows — accurate, complete, wrong grain. */}
        <Card>
          <CardBody className="gap-5">
            <div className="flex items-baseline justify-between gap-4">
              <Heading level={3} size={4}>
                What your payroll run says
              </Heading>
              <Text as="span" className="font-mono">
                March
              </Text>
            </div>
            <div className="flex flex-col">
              {PAYROLL.map((row) => (
                <HourRow key={row.label} who={row.label} cost={row.value} />
              ))}
            </div>
            <div className="border-base-300 border-t pt-2">
              <HourRow who="Gross wages" cost="$18,470.00" emphasis />
            </div>
            <Text>
              Every figure is right, everyone got paid, and the filings went out on time. That is
              what a payroll system is for, and sparx will never try to take that job from it.
            </Text>
          </CardBody>
        </Card>

        {/* What you asked — unanswerable at that grain. */}
        <Card>
          <CardBody className="gap-5">
            <Heading level={3} size={4}>
              What you actually asked
            </Heading>
            <Heading level={4} size={3} className="max-w-[18ch]">
              “Was the Farrow rebuild worth doing?”
            </Heading>
            <Text>
              Payroll never saw a rebuild. It saw a fortnight, four people, and a gross figure — in
              a month that also held nineteen other jobs, two warranty callbacks and a day everybody
              spent tidying the yard. Nothing in that report knows which hours belong to which work,
              because nobody ever wrote it down anywhere it could be counted.
            </Text>
            <Text>
              So the honest answer from a payroll system is that it cannot say. And the answer you
              end up with is a feeling: it took longer than you quoted, but you got paid, so it
              probably came out fine.
            </Text>
            <div className="border-base-300 flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-5">
              <Badge color="error" size="sm">
                −$12.10
              </Badge>
              <Text as="span">is what the Farrow rebuild actually did. It took four sections.</Text>
            </div>
          </CardBody>
        </Card>
      </div>
    </Section>
  );
}

// ── BEAT 4 · THE TURN (LAYER 5) ──────────────────────────────────────────────
//
// The one section on the page painted in the module's own hue (DESIGN.md §2.5),
// at the one moment the page makes the argument only sparx can make: an hour is
// not a cost until you know the rate in force on the day it was worked AND the
// work it went into — and sparx is already holding the second half, because the
// job is in the same database.
//
// No <Spark> and no <SectionHeader>: a `text-module-staff` full stop on a
// `bg-module-staff` field is brown on brown, and at the standard h2 size the
// climax reads quieter than the sections it pays off. Same reasoning as
// FinanceTurn and CrmTurn.
//
// The PRICE is deliberately NOT here, unlike /finance. Finance's price is an
// argument ("we already sold you the other half, so it is free"); this module's
// $29 is just a price, and dropping it into the climax would trade a principle
// for a line item.
export function StaffTurn() {
  const beats: { title: string; body: string }[] = [
    {
      title: 'The rate is a row, not a column',
      body: 'A pay rate here has a start date. Give somebody a raise and the old rate closes the day before the new one opens, so an hour worked in March is still costed at March’s rate. Systems that store the rate on the person quietly rewrite every job that person has ever touched the moment you edit it.',
    },
    {
      title: 'The hour knows what it was for',
      body: 'Clocking in can name the job, and a typed entry can too — because the job is already in this database. That one field is the whole difference between a timesheet and a cost: without it you have hours, with it you have what the work took.',
    },
    {
      title: 'So the wages line stops being typed',
      body: 'Approve a timesheet and those hours are costed at the rate in force on each day, marked up by your employer costs, and filed as spending under Wages — split by business, and charged to the jobs they named. Nobody estimates anything.',
    },
  ];
  return (
    <Section id="the-turn" surface="module" module="staff" padding="lg">
      <h2 className="max-w-[20ch] text-[clamp(34px,5vw,64px)] leading-[1.03] font-medium tracking-[-0.03em] sm:max-w-none">
        An hour isn’t a cost until you know the rate that day and the job it went on.
      </h2>
      <p className="mt-7 max-w-[880px] text-2xl leading-[1.45]">
        A time clock records the hour. A payroll bureau prices it. Neither has ever seen the job,
        because the job lives in a different system — so the two halves never meet, and the biggest
        number in your business stays an estimate. sparx is already holding the job.
      </p>
      <div className="mt-16 grid grid-cols-1 gap-x-10 gap-y-9 sm:grid-cols-3">
        {beats.map((b) => (
          <div key={b.title}>
            <h3 className="text-2xl font-medium tracking-[-0.02em]">{b.title}</h3>
            <p className="text-md mt-3 leading-[1.55]">{b.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── BEAT 5a · IT RECORDS THE HOUR ────────────────────────────────────────────
//
// The first consequence, and the smallest. Deliberately unglamorous: the whole
// chain rests on the hour existing at all, and the reason hours do not get
// recorded is friction, not unwillingness.

const ELLISON: { who: string; detail: string; hours: string; cost: string }[] = [
  { who: 'Dave Okonjo', detail: 'diagnosis and strip-down', hours: '8.0 h', cost: '$273.28' },
  { who: 'Marta Reyes', detail: 'refit and road test', hours: '4.5 h', cost: '$142.74' },
  { who: 'Sam Whitfield', detail: 'parts run and clean-up', hours: '2.0 h', cost: '$53.68' },
];

export function StaffClock() {
  return (
    <Section surface="surface" padding="lg">
      <div className="max-w-[820px]">
        <SectionHeader
          accent={M.ink}
          headline={<>An hour gets recorded in about four seconds, or it doesn’t get recorded</>}
          lede={
            <>
              Somebody taps in on a phone in the yard, or types “3.5 on the Ellison job” back at the
              desk on Friday. Both are real ways people work and both are first-class here — the
              only thing that matters is that the hour lands somewhere with the job attached before
              the memory of it goes.
            </>
          }
        />
      </div>

      <div className="mt-14 grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.15fr_1fr]">
        <Card>
          <CardBody className="gap-5">
            <div className="flex items-baseline justify-between gap-4">
              <Heading level={3} size={4}>
                Ellison — brake overhaul
              </Heading>
              <HourState tone="warning">Waiting on you</HourState>
            </div>
            <div className="flex flex-col">
              {ELLISON.map((row) => (
                <HourRow
                  key={row.who}
                  who={row.who}
                  detail={row.detail}
                  hours={row.hours}
                  cost={row.cost}
                />
              ))}
            </div>
            <div className="border-base-300 border-t pt-2">
              <HourRow who="14.5 hours on this job" cost="$469.70" emphasis />
            </div>
            <Text className="text-sm">
              Costed at each person’s rate for the day they worked it, employer costs included.
            </Text>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-6">
          <div>
            <Heading level={3} size={4}>
              Three ways in, one record out
            </Heading>
            <Text className="mt-3">
              A phone clock for the people on the floor. A duration typed straight in for the ones
              who would rather write it down once at the end of the day. A bulk import for the
              fortnight you are catching up on. All three become the same kind of entry, so nothing
              downstream has to care which it was.
            </Text>
          </div>
          <div>
            <Heading level={3} size={4}>
              A shift is not a timesheet
            </Heading>
            <Text className="mt-3">
              What you rostered and what actually happened are separate records here, on purpose.
              Every scheduling product eventually treats them as one number, and the moment it does,
              the difference between the week you planned and the week you paid for disappears — and
              that difference is usually where the money went.
            </Text>
          </div>
          <div>
            <Heading level={3} size={4}>
              Nothing counts until somebody says so
            </Heading>
            <Text className="mt-3">
              Hours wait for approval before they reach a single figure anywhere else. A timesheet
              that pushed itself into your profit the moment somebody clocked out would mean every
              mistyped shift moved the month before anyone had looked at it.
            </Text>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ── BEAT 5b · IT PRICES THE HOUR, AND REFUSES TO GUESS ───────────────────────
//
// The section that carries the module's one real conviction. `Unpriced` is the
// device: hours that exist and cannot be costed are reported as a number, in
// red, rather than silently valued at nothing.

export function StaffRates() {
  return (
    <Section id="what-it-costs" padding="lg">
      <div className="max-w-[820px]">
        <SectionHeader
          accent={M.ink}
          headline={<>What an hour costs you is not what it says on the payslip</>}
          lede={
            <>
              Your share of payroll taxes, workers’ comp, insurance — the part that never appears on
              anybody’s wage but comes out of the same money. Tell sparx once what that adds up to
              as a percentage and every hour after it is costed honestly. Leave it out and your
              labour figure runs fifteen to thirty percent light, which is exactly the kind of wrong
              that feels fine right up until the year-end.
            </>
          }
        />
      </div>

      <div className="mt-14 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardBody className="gap-5">
            <Heading level={3} size={4}>
              One hour of Dave’s time
            </Heading>
            <div className="flex flex-col">
              <HourRow who="On the payslip" detail="his hourly wage" cost="$28.00" />
              <HourRow
                who="Employer costs"
                detail="22% — the share that never reaches his pocket"
                cost="+ $6.16"
              />
            </div>
            <div className="border-base-300 border-t pt-2">
              <HourRow who="What the hour costs you" cost="$34.16" emphasis />
            </div>
            <Text>
              Eight of those went into the Ellison job. That is $273.28 of a $1,240 invoice, and it
              is a number nobody at Ridgeline could have told you before, because it was never
              written down in one place.
            </Text>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="gap-5">
            <div className="flex items-baseline justify-between gap-4">
              <Heading level={3} size={4}>
                And when it can’t
              </Heading>
              <Unpriced>62 hours unpriced</Unpriced>
            </div>
            <Text>
              Marta’s first fortnight was logged before anybody got round to recording what she
              earns. Sixty-two hours, all real, none of them costable.
            </Text>
            <Text>
              So sparx does not cost them at zero. The timesheet says sixty-two hours are unpriced,
              the period total says “so far” instead of pretending to be finished, and the wage
              figure it files is short by exactly that much and says so. A zero here becomes a zero
              in your profit — and you would read that as a fortnight where the work was free.
            </Text>
            <div className="border-base-300 flex flex-col gap-2 border-t pt-5">
              <Text className="text-sm">
                Add her rate afterwards, dated from her first day, and the fortnight prices itself.
                Nothing else moves — everyone else’s March is untouched, because their rates were
                already the rates in force.
              </Text>
            </div>
          </CardBody>
        </Card>
      </div>
    </Section>
  );
}
