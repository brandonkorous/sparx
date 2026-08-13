import { Badge, Card, CardBody, Heading, Text } from '@wizeworks/silicaui-react';
import { Section, SectionHeader } from './primitives';
import { costFill, netTone } from './finance-money';
import { HourRow, M } from './staff-hours';

/**
 * /staff, the back half — the last two consequences, the week that runs itself,
 * and the resolution. Beats 3–5b and the worked example's provenance are in
 * `staff-sections.tsx`; the page shell is in `staff-page.tsx`.
 *
 * The same Ridgeline Service March runs through here: sales $61,300, cost of the
 * work $22,840, wages $22,533, running costs $9,410, kept $6,517. And the two
 * jobs the page has been promising since beat 3 — Ellison at $358.30 kept,
 * Farrow at −$12.10.
 *
 * THE TWO WAGE FIGURES ARE DIFFERENT ON PURPOSE and the page says so out loud.
 * Beat 3's payroll run reports GROSS pay, $18,470. The chart below reports what
 * those hours COST the business, $22,533.40 — the same figure plus the 22%
 * employer costs beat 5b introduced. Printing one number in both places would
 * have been tidier and would have quietly contradicted the argument the whole
 * page is making.
 */

// ── BEAT 5c · WAGES BECOME A REAL LINE ───────────────────────────────────────
//
// The three cost hues are imported from `finance-money` rather than re-picked.
// That is the argument made in pixels: this page claims hours turn into the
// wages line on the Finance screen, so the wages slice here must be the same
// blue it is over there. Two vocabularies for one idea is how a product stops
// looking like the thing that was advertised.

const MARCH: { label: string; amount: string; pct: number; fill: string; tone?: string }[] = [
  { label: 'Cost of the work', amount: '$22,840', pct: 37.3, fill: costFill('work') },
  { label: 'Wages', amount: '$22,533', pct: 36.8, fill: costFill('wages') },
  { label: 'Running costs', amount: '$9,410', pct: 15.3, fill: costFill('running') },
  { label: 'Kept', amount: '$6,517', pct: 10.6, fill: 'bg-success', tone: netTone(false) },
];

export function StaffWages() {
  return (
    <Section surface="surface" padding="lg">
      <div className="max-w-[820px]">
        <SectionHeader
          accent={M.ink}
          headline={<>The biggest number in the business stops being an estimate</>}
          lede={
            <>
              Approve a fortnight and those hours are costed at each day’s rate, marked up by your
              employer costs, and filed as spending under Wages — split across your businesses, and
              charged to the jobs the hours named. If you run Finance, that is the wages slice below
              arriving on its own. If you don’t, the hours and the total are still yours.
            </>
          }
        />
      </div>

      <div className="mt-14 grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardBody className="gap-5">
            <div className="flex items-baseline justify-between gap-4">
              <Heading level={3} size={4}>
                Where March went
              </Heading>
              <Text as="span" className="font-mono">
                $61,300 in
              </Text>
            </div>

            {/* One month of takings, to scale. Inline widths are the genuinely
                dynamic case — there is no utility class for 37.3%. */}
            <div className="flex h-6 w-full gap-[3px] overflow-hidden rounded-lg" aria-hidden>
              {MARCH.map((slice) => (
                <span key={slice.label} className={slice.fill} style={{ width: `${slice.pct}%` }} />
              ))}
            </div>

            <div className="flex flex-col">
              {MARCH.map((slice, index) => (
                <div
                  key={slice.label}
                  className={`flex items-baseline justify-between gap-4 py-2.5 ${
                    index === MARCH.length - 1 ? 'border-base-300 mt-1 border-t pt-4' : ''
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`${slice.fill} h-2.5 w-2.5 shrink-0 rounded-full`}
                      aria-hidden
                    />
                    <Text
                      as="span"
                      className={index === MARCH.length - 1 ? 'font-medium' : undefined}
                    >
                      {slice.label}
                    </Text>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-3">
                    <Text as="span" className="font-mono tabular-nums">
                      {slice.pct}%
                    </Text>
                    <span
                      className={`${slice.tone ?? ''} min-w-[8ch] text-right font-medium tabular-nums`}
                    >
                      {slice.amount}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-6">
          <div>
            <Heading level={3} size={4}>
              $18,470 on the payroll run. $22,533 out of the business.
            </Heading>
            <Text className="mt-3">
              Both numbers are right, and the gap between them is the 22% that never reaches
              anybody’s pocket. Ridgeline had been doing this arithmetic with the smaller figure,
              which made labour look like a third of the month rather than more than a third — and
              made every job quoted off that assumption a little thinner than it appeared.
            </Text>
          </div>
          <div>
            <Heading level={3} size={4}>
              A salary costs the calendar, not the timesheet
            </Heading>
            <Text className="mt-3">
              Somebody on a salary is being paid this month whether or not they clocked anything, so
              they appear in the figure whether or not they clocked anything. A system that costed
              only what got logged would quietly leave the biggest wages in most businesses out of
              the total — because salaried people are exactly the ones who never clock.
            </Text>
          </div>
          <div>
            <Heading level={3} size={4}>
              Two businesses, two sets of books
            </Heading>
            <Text className="mt-3">
              If somebody works across both of the things you own, their hours cost each one
              separately — the workshop’s wages and the parts counter’s wages are two figures, not
              one divided by guesswork.
            </Text>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ── BEAT 5d · WHICH WORK PAID FOR ITSELF ─────────────────────────────────────
//
// The top of the escalation, and the payoff for the promise made in beat 3.
// Worst-first, because the losing job is the one a decision can still be made
// about. Requires Finance to be on — and the section says so rather than
// implying every reader gets this screen.

const JOBS: {
  name: string;
  who: string;
  charged: string;
  parts: string;
  hours: string;
  labour: string;
  kept: string;
  rate: string;
  negative: boolean;
}[] = [
  {
    name: 'Farrow — engine rebuild',
    who: 'Dave, Priya',
    charged: '$1,980',
    parts: '$1,120',
    hours: '26.0 h',
    labour: '$872.10',
    kept: '−$12.10',
    rate: '−0.6%',
    negative: true,
  },
  {
    name: 'Wynn — clutch replacement',
    who: 'Marta',
    charged: '$860',
    parts: '$395',
    hours: '12.0 h',
    labour: '$410.00',
    kept: '$55.00',
    rate: '6.4%',
    negative: false,
  },
  {
    name: 'Ellison — brake overhaul',
    who: 'Dave, Marta, Sam',
    charged: '$1,240',
    parts: '$412',
    hours: '14.5 h',
    labour: '$469.70',
    kept: '$358.30',
    rate: '28.9%',
    negative: false,
  },
  {
    name: 'Kestrel — fleet service ×4',
    who: 'Priya, Sam',
    charged: '$2,960',
    parts: '$640',
    hours: '33.0 h',
    labour: '$1,127.28',
    kept: '$1,192.72',
    rate: '40.3%',
    negative: false,
  },
];

export function StaffJobs() {
  return (
    <Section id="by-job" padding="lg">
      <div className="max-w-[860px]">
        <SectionHeader
          accent={M.ink}
          headline={<>And then the question from four sections ago has an answer</>}
          lede={
            <>
              Every job ranked by what you kept on it, worst first — because the one that lost money
              is the one you can still do something about. The hours are what make this possible:
              without them a job’s cost is its parts, and parts were never the part you were getting
              wrong.
            </>
          }
        />
      </div>

      <Card className="mt-14">
        <CardBody className="gap-0">
          <div className="border-base-300 flex items-baseline justify-between gap-4 border-b pb-4">
            <Heading level={3} size={4}>
              March, worst first
            </Heading>
            <Text as="span" className="font-mono">
              Ridgeline Service
            </Text>
          </div>

          {JOBS.map((job) => (
            <div key={job.name} className="border-base-300 flex flex-col gap-2 border-b py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <Heading level={4} size={5}>
                  {job.name}
                </Heading>
                <span className="flex shrink-0 items-center gap-3">
                  <span className={`${netTone(job.negative)} text-2xl font-medium tabular-nums`}>
                    {job.kept}
                  </span>
                  {/* SOLID. This is the number the whole list is scanned for, and
                      state is its own colour axis — never the module hue. */}
                  <Badge
                    color={job.negative ? 'error' : 'success'}
                    size="sm"
                    className="tabular-nums"
                  >
                    {job.rate}
                  </Badge>
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                <Text as="span" className="text-sm">
                  Charged <span className="font-medium tabular-nums">{job.charged}</span>
                </Text>
                <Text as="span" className="text-sm">
                  Parts <span className="font-medium tabular-nums">{job.parts}</span>
                </Text>
                <Text as="span" className="text-sm">
                  <span className="font-medium tabular-nums">{job.hours}</span> of work ·{' '}
                  <span className="font-medium tabular-nums">{job.labour}</span>
                </Text>
                <Text as="span" className="text-sm">
                  {job.who}
                </Text>
              </div>
            </div>
          ))}

          <div className="flex flex-col gap-3 pt-6">
            <Text>
              The Farrow rebuild came in at twenty-six hours against the sixteen it was quoted at,
              and that is the entire difference between a job that made $300 and one that lost
              twelve dollars. Nobody was careless — it just took longer, and until the hours were
              written against the job, there was nothing anywhere that could say so.
            </Text>
            <Text className="text-sm">
              Job-by-job profit is the Finance module’s screen. Team is what puts the labour into
              it; run them together and the ranking includes what the work actually took.
            </Text>
          </div>
        </CardBody>
      </Card>
    </Section>
  );
}

// ── THE WEEK ─────────────────────────────────────────────────────────────────
//
// Everything that is not the cost chain, in one section rather than three thin
// ones. It sits after the payoff on purpose: a reader who came for "what does an
// hour cost" has their answer by now, and this is what they get as well.

export function StaffWeek() {
  const parts: { title: string; body: string }[] = [
    {
      title: 'The rota, built as a draft',
      body: 'Lay next week out over however many sittings it takes and release it in one act, so nobody is reading a half-finished rota off the wall. Approved time off is already on the same grid, which is how "who is actually free on Thursday" stops being a question you answer from memory.',
    },
    {
      title: 'Time off with an answer',
      body: 'Requests arrive in a queue that shows what is waiting on you rather than everything that ever happened. Approve one and those days come off the rota — and if that person is bookable by your customers, the booking system stops offering them, then starts again if the leave is withdrawn.',
    },
    {
      title: 'Licences that warn you first',
      body: 'A ticket, a licence, an inspection certificate — each with as much notice as you actually need, because the one you renew by post is not the one you renew online. Expired shows red on the roster before you assign the job. And a qualification that never expires is recorded as exactly that, so it never nags you.',
    },
    {
      title: 'People who never log in',
      body: 'The technician who has never opened sparx still has hours, a rate, and a licence with a date on it — and is very often the person whose cost matters most. Nobody here needs a login to exist, and nobody is charged for having one.',
    },
  ];
  return (
    <Section surface="surface" padding="lg">
      <div className="max-w-[820px]">
        <SectionHeader
          accent={M.ink}
          headline={<>The rest of the week, handled</>}
          lede={
            <>
              The cost figure is the argument. This is the part you use on a Monday morning — and
              the reason a business with nine people on the floor keeps it open rather than opening
              it once a fortnight.
            </>
          }
        />
      </div>
      <div className="mt-14 grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2">
        {parts.map((part) => (
          <div key={part.title}>
            <Heading level={3} size={4}>
              {part.title}
            </Heading>
            <Text className="mt-3">{part.body}</Text>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── BEAT 6 · RESOLUTION ──────────────────────────────────────────────────────
//
// Closes the loop opened in beat 3: the payroll run was right, and it stays
// exactly where it is. THE COPY HERE IS LOAD-BEARING AND HONEST — what ships is
// a downloadable hours file with each person's payroll id on it, nothing more,
// and this section says that rather than implying an integration.

export function StaffHandoff() {
  return (
    <Section id="payroll" padding="lg">
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_1fr]">
        <div className="max-w-[560px]">
          <SectionHeader
            accent={M.ink}
            headline={<>Payroll stays exactly where it is</>}
            lede={
              <>
                sparx does not withhold tax, does not file anything, does not administer a benefit,
                and does not pay anybody — not in this version and not in a later one. Becoming a
                tax filer in fifty states is a different company, and the people who already do it
                have spent a decade earning the trust it takes.
              </>
            }
          />
          <Text className="mt-6">
            What sparx owes your payroll bureau is the hours, and that is what it hands over: every
            approved hour for the period, per person, with their id in your payroll system on the
            row so nobody is matching names in a spreadsheet at eight on a Friday.
          </Text>
        </div>

        <Card>
          <CardBody className="gap-5">
            <div className="flex items-baseline justify-between gap-4">
              <Heading level={3} size={4}>
                hours-2026-03-01-to-2026-03-31.csv
              </Heading>
              <Text as="span" className="font-mono">
                9 people
              </Text>
            </div>
            <div className="flex flex-col">
              <HourRow who="Dave Okonjo" detail="EMP-0114" hours="80.00 h" cost="$2,732.80" />
              <HourRow who="Marta Reyes" detail="EMP-0119" hours="80.00 h" cost="$2,537.60" />
              <HourRow who="Sam Whitfield" detail="EMP-0122" hours="80.00 h" cost="$2,147.20" />
            </div>
            <div className="border-base-300 border-t pt-2">
              <HourRow who="Everybody, March" hours="672.00 h" cost="$22,533.40" emphasis />
            </div>
            <Text className="text-sm">
              Hours in decimal, because that is what a payroll system parses — the screens say “7h
              30m” because that is what a person reads. Any hours nobody could price are in the
              hours column and flagged separately, never dropped: they still have to be paid.
            </Text>
          </CardBody>
        </Card>
      </div>
    </Section>
  );
}

// ── CAPABILITIES ─────────────────────────────────────────────────────────────
//
// The reference list, last, for the reader who has already been convinced and
// now wants to check their own edge case. Deliberately after the argument: put
// it earlier and the page becomes the feature inventory it is trying not to be.

export function StaffCapabilities() {
  const groups: { title: string; items: string[] }[] = [
    {
      title: 'People',
      items: [
        'Employees, contractors and volunteers — a cost distinction, never a legal one',
        'Nobody needs a login to be on the roster',
        'Links to their sparx login and their bookable calendar when those exist',
        'Works across every business you run under one account',
        'Somebody who leaves is archived, not deleted — last year’s figures keep their subject',
      ],
    },
    {
      title: 'Hours and pay',
      items: [
        'Clock in and out from a phone, or type a duration in afterwards',
        'Hours can name the order or booking they went into',
        'Effective-dated pay rates — hourly, salaried, commission, or unpaid',
        'Employer costs as a percentage on top, so labour is not 15–30% light',
        'Approval before anything counts, and a deliberate reopen to correct it',
        'Unpriced hours reported as a number, never costed at zero',
      ],
    },
    {
      title: 'The week',
      items: [
        'Shifts by week, per business, drafted then published in one act',
        'Time-off requests with an approve/decline queue',
        'Approved leave blocks the booking calendar, and cancelling releases it',
        'Certifications and licences with per-item warning windows',
        'Commission recorded against an order or a deal, once per sale',
      ],
    },
    {
      title: 'Where it goes',
      items: [
        'Wages filed into Finance as spending, per business and per job',
        'Safe to re-file — it updates the same records rather than doubling them',
        'A payroll hours file with each person’s payroll id',
        'Everything reachable through the same API and MCP as the rest of sparx',
      ],
    },
  ];
  return (
    <Section surface="surface" padding="lg">
      <div className="max-w-[760px]">
        <SectionHeader accent={M.ink} headline={<>Everything in the module</>} />
      </div>
      <div className="mt-12 grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {groups.map((group) => (
          <div key={group.title}>
            <Heading level={3} size={5}>
              {group.title}
            </Heading>
            <ul className="mt-4 flex list-none flex-col gap-3 p-0">
              {group.items.map((item) => (
                <li key={item} className="flex items-baseline gap-2.5">
                  <span
                    className={`${M.bg} relative top-[6px] h-1.5 w-1.5 shrink-0 rounded-full`}
                    aria-hidden
                  />
                  <Text as="span" className="text-sm">
                    {item}
                  </Text>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
