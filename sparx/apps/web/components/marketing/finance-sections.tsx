import { Badge, Card, CardBody, Heading, Text } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Dot, Section, SectionHeader } from './primitives';
import { CostLegend, costFill, M, MoneyRow, netTone, type CostKind } from './finance-money';
import { signupHref } from './cta';

/**
 * /finance, beats 3 and 4 — the false fix and the turn — plus the first two
 * consequences (it records, it chases). The remaining consequences and the
 * resolution live in `finance-profit.tsx`; the page shell and its story map are
 * in `finance-page.tsx`.
 *
 * One worked example runs through every device on this page: a small sign and
 * print shop's March. Sales $48,210, cost of the work $19,640, wages $14,300,
 * running costs $6,180, kept $8,090. Every figure in every section reconciles to
 * those five, deliberately — a marketing page about money whose own numbers do
 * not add up is arguing against itself, and a reader who checks one column is
 * exactly the reader this module is for.
 */

// ── BEAT 3 · THE FALSE FIX ───────────────────────────────────────────────────
//
// The move this section makes is NOT "accounting software is bad." It is that
// the books are RIGHT and still cannot answer the question — which is a much
// harder claim to argue with, and it is the honest one (docs/148 §1: never
// compete with QuickBooks; the boundary is permanent).
//
// So the left panel is deliberately correct: those are real deduction
// categories, and they sum to the same $8,090 the rest of the page uses. The
// page then concedes the total and attacks the GRAIN. That concession is what
// buys the turn its credibility one section later.

/** The books' answer — an accountant's categories, correct and complete. */
const LEDGER: { label: string; value: string }[] = [
  { label: 'Cost of goods sold', value: '$19,640' },
  { label: 'Salaries and wages', value: '$14,300' },
  { label: 'Rent or lease', value: '$2,900' },
  { label: 'Vehicle expense', value: '$780' },
  { label: 'Office expense', value: '$640' },
  { label: 'Insurance', value: '$410' },
  { label: 'Utilities', value: '$318' },
  { label: 'Other deductions', value: '$1,132' },
];

export function FinanceFalseFix() {
  return (
    <Section id="the-question" padding="lg">
      <div className="max-w-[820px]">
        <SectionHeader
          headline={<>So you buy accounting software, and it answers a different question</>}
          lede={
            <>
              Not a worse one — a different one. Your books exist to be filed: they sort every
              dollar into the categories a tax form recognises, and they get it right. Then you ask
              the question you actually had, and the categories have already thrown the answer away.
            </>
          }
        />
      </div>

      <div className="mt-14 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {/* What the books know — correct, complete, and the wrong grain. */}
        <Card>
          <CardBody className="gap-5">
            <div className="flex items-baseline justify-between gap-4">
              <Heading level={3} size={4}>
                What your books say
              </Heading>
              <Text as="span" className="font-mono">
                March
              </Text>
            </div>
            <div className="flex flex-col">
              {LEDGER.map((row) => (
                <MoneyRow key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
            <div className="border-base-300 border-t pt-2">
              <MoneyRow label="Kept" value="$8,090" emphasis tone={netTone(false)} />
            </div>
            <Text>
              Every line is accurate and the total is right — it is the same $8,090 this page uses
              everywhere else. Filing this is exactly what an accounting package is for, and sparx
              will never try to take that job from it.
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
              “Did the van wrap make money?”
            </Heading>
            <Text>
              Your books never saw a van wrap. They saw a $412 vinyl purchase on the 4th, a $180
              laminate purchase on the 9th, and a payroll run on the 15th — three entries in three
              categories, in a month that also contained ten other jobs. Nothing in that file knows
              those three belong together, because nothing ever told it.
            </Text>
            <Text>
              So the honest answer from an accounting package is that it cannot say, and the answer
              you end up with is a feeling. Eleven jobs went out the door in March. You are fairly
              sure most of them were fine.
            </Text>
            <div className="border-base-300 flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-5">
              <Badge color="error" size="sm">
                −$740
              </Badge>
              <Text as="span">
                is what the van wrap actually did. The page gets to that in two sections.
              </Text>
            </div>
          </CardBody>
        </Card>
      </div>
    </Section>
  );
}

// ── BEAT 4 · THE TURN (LAYER 5) ──────────────────────────────────────────────
//
// The one section on the page painted in Finance's own hue (DESIGN.md §2.5), at
// the one moment the page makes the argument only sparx can make: half of a
// profit calculation is already in the database, so the other half is a short
// form rather than a second system — and if you sell here, we do not charge you
// for it at all.
//
// THE PRICE LIVES IN THE TURN, which is unusual for these pages and deliberate
// here. "Free with Commerce or B2B" is not a discount, it is the same argument
// the section is already making: profit is revenue minus spend, we have the
// revenue half, and billing separately for the subtrahend is charging twice for
// one number (docs/148 §2). Putting it anywhere else on the page turns a
// principle back into a promotion.
//
// No <Spark> and no <SectionHeader>: a `text-module-finance` full stop on a
// `bg-module-finance` field is green on green, and at the standard h2 size the
// climax reads quieter than the sections it pays off. Same reasoning as CrmTurn.
export function FinanceTurn() {
  const beats: { title: string; body: string }[] = [
    {
      title: 'Half the sum is already here',
      body: 'What you sold is recorded. What each part cost coming off the shelf is recorded, at the price you actually paid for it. What the marketplace or the card processor took is recorded. None of that is re-typed, re-imported, or estimated — the profit figure reads it where it already lives.',
    },
    {
      title: 'You type what nothing else knows',
      body: 'The rent. The fuel. The software you forgot you were paying for. That is the half no system in your business has ever seen, it is genuinely small, and the ones that repeat every month record themselves after you set them up once.',
    },
    {
      title: 'So we don’t charge you twice for it',
      body: 'If you sell through sparx — Commerce or B2B — Finance is included at no extra cost. You already bought the revenue half of this sum. Charging you again for the part we subtract from it would be selling you one number twice.',
    },
  ];
  return (
    <Section id="the-turn" surface="module" module="finance" padding="lg">
      <h2 className="max-w-[19ch] text-[clamp(34px,5vw,64px)] leading-[1.03] font-medium tracking-[-0.03em] sm:max-w-none">
        Profit is what came in minus what went out. We already have the first half.
      </h2>
      <p className="mt-7 max-w-[880px] text-2xl leading-[1.45]">
        A spend tracker starts from zero and asks you for everything, because it has never seen your
        sales. sparx has. Every order, every invoice, every part that left the shelf and what it
        cost you is already sitting in the same database — so switching Finance on doesn’t start a
        second set of records. It finishes the one you already have.
      </p>
      <div className="mt-16 grid grid-cols-1 gap-x-10 gap-y-9 sm:grid-cols-3">
        {beats.map((b) => (
          <div key={b.title}>
            <h3 className="text-2xl font-medium tracking-[-0.02em]">{b.title}</h3>
            <p className="text-md mt-3 leading-[1.55]">{b.body}</p>
          </div>
        ))}
      </div>
      {/* A painted band is a fill, not a theme scope, so the control is SOLID:
          near-black `neutral` on Finance green, the same pairing /crm's turn and
          /platform's pricing band use. An outline or ghost button would ink
          itself from the LIGHT theme and land near-black by accident. */}
      <div className="mt-14 flex flex-wrap items-center gap-x-7 gap-y-4">
        <a
          href={signupHref('finance-turn')}
          className={buttonClasses({ color: 'neutral', size: 'xl' })}
        >
          Switch Finance on →
        </a>
        <p className="text-md">Free with Commerce or B2B. $29 a month on its own.</p>
      </div>
    </Section>
  );
}

// ── BEAT 5a · IT RECORDS ─────────────────────────────────────────────────────
//
// The chain of consequences starts at the least glamorous end on purpose: none
// of the analysis further down this page exists if entering a cost is annoying.
// docs/148 §5 makes the same point about the product ("this is the surface
// people live in, so entry has to be seconds"), and the quick-entry row is
// modelled on what actually shipped — amount, what for, category, Enter to save,
// focus back on the amount, category deliberately sticky.

/** Costs already recorded this month, as the Spending list shows them. */
const RECORDED: { amount: string; what: string; kind: CostKind; when: string; note?: string }[] = [
  {
    amount: '$412.00',
    what: 'Vinyl and laminate — Sutter Supply',
    kind: 'work',
    when: 'Mar 4',
    note: 'van wrap',
  },
  {
    amount: '$2,900.00',
    what: 'Unit 4 rent — Harbourgate',
    kind: 'running',
    when: 'Mar 1',
    note: 'repeats monthly',
  },
  {
    amount: '$318.44',
    what: 'Power and water',
    kind: 'running',
    when: 'Mar 2',
    note: 'repeats monthly',
  },
  {
    amount: '$1,240.00',
    what: 'Aluminium sheet — Sutter Supply',
    kind: 'work',
    when: 'Mar 6',
    note: 'unpaid · due Mar 20',
  },
];

export function FinanceSpending() {
  return (
    <Section id="recording" surface="surface" padding="lg">
      <div className="max-w-[820px]">
        <SectionHeader
          accent={M.ink}
          headline={<>Writing a cost down takes about four seconds</>}
          lede={
            <>
              A shoebox of receipts is a run of the same kind of thing, so the row you type into is
              always open at the top of the list: how much, what for, which kind. Press Enter and
              the cursor is back on the amount with the category still set, ready for the next one.
              No form, no dialog, no trip to another screen.
            </>
          }
        />
      </div>

      <div className="mt-14 grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.15fr_1fr]">
        <Card>
          <CardBody className="gap-0">
            {/* The quick-entry row, mid-typing. Rendered as static markup, not a
                real input: this is a picture of the product, and a focused-looking
                text field a visitor cannot type into is worse than an honest
                still. */}
            <div className="border-base-300 bg-base-200 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border p-4">
              <span className="text-2xl font-medium tabular-nums">$84.60</span>
              <span className="border-base-300 min-w-[14ch] flex-1 border-b pb-1">
                <Text as="span">Matte white vinyl — one roll</Text>
              </span>
              <Badge color="warning" size="sm">
                Cost of the work
              </Badge>
              <span className={buttonClasses({ color: 'module-finance', size: 'sm' })}>Save</span>
            </div>

            <Text className="mt-4 mb-2 font-mono">Recorded this month</Text>
            <div className="flex flex-col">
              {RECORDED.map((row) => (
                <div
                  key={row.what}
                  className="border-base-200 flex items-baseline justify-between gap-6 border-t py-3 first:border-t-0"
                >
                  <span className="flex min-w-0 items-baseline gap-2.5">
                    <Dot fill={costFill(row.kind)} size={8} />
                    <span className="min-w-0">
                      <Text as="span">{row.what}</Text>
                      <Text as="span" className="ml-2 font-mono">
                        {row.when}
                        {row.note ? ` · ${row.note}` : ''}
                      </Text>
                    </span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">{row.amount}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardBody className="gap-3">
              <Heading level={3} size={4}>
                The ones that repeat, repeat
              </Heading>
              <Text>
                Rent, insurance, the software subscriptions, the lease on the van. Set each one up
                once — how much, how often, which kind — and it records itself on the day it falls
                due, every month, without you remembering. The two lines above with “repeats
                monthly” on them were never typed in March.
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="gap-3">
              <Heading level={3} size={4}>
                Two dates, never one
              </Heading>
              <Text>
                Every cost carries the day it happened and the day the money actually left. That
                sounds like bookkeeping pedantry until you pay your suppliers on the 1st: bucket a
                month on payment dates and every month looks like a disaster followed by a miracle.
                Profit is worked out on when the cost was incurred, which is the month it belongs
                to.
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="gap-3">
              <Heading level={3} size={4}>
                Your words for it, not ours
              </Heading>
              <Text>
                Finance starts with nineteen sensible categories and expects you to change them. Add
                “bay consumables”, rename anything, delete what you will never use — each one just
                says which of the three kinds it rolls up under, so the profit figure keeps working
                however you name things.
              </Text>
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="border-base-300 mt-12 border-t pt-8">
        <CostLegend />
      </div>
    </Section>
  );
}

// ── BEAT 5b · IT CHASES ──────────────────────────────────────────────────────
//
// The pairing IS the argument, so the two columns are visually identical and
// only the direction changes. docs/148 §5: "the exact mirror of the shipping
// 'Owed to you' surface, and the pairing is the point: one screen for each
// direction." Most businesses run one of these in an accounting package and the
// other in their head.

interface DueRow {
  who: string;
  amount: string;
  when: string;
  tone: 'error' | 'warning' | 'neutral';
}

const OWED_TO_YOU: DueRow[] = [
  { who: 'Delaney’s Bakery', amount: '$2,400.00', when: '14 days late', tone: 'error' },
  { who: 'Kessler Ave Dental', amount: '$860.00', when: 'due in 3 days', tone: 'warning' },
  { who: 'Provincial Trades Co', amount: '$5,100.00', when: 'due in 21 days', tone: 'neutral' },
];

const YOU_OWE: DueRow[] = [
  { who: 'Sutter Supply', amount: '$1,240.00', when: '6 days late', tone: 'error' },
  { who: 'Harbourgate Utilities', amount: '$318.44', when: 'due tomorrow', tone: 'warning' },
  { who: 'Harbourgate Property', amount: '$2,900.00', when: 'due in 9 days', tone: 'neutral' },
];

export function FinanceBills() {
  return (
    <Section id="both-directions" padding="lg">
      <div className="max-w-[820px]">
        <SectionHeader
          accent={M.ink}
          headline={<>Money is owed in both directions. Most businesses only track one</>}
          lede={
            <>
              You know to the dollar who owes you, because chasing it is how you get paid. What you
              owe tends to live in an inbox, a drawer, and a rough sense that rent is due soon —
              until a supplier puts you on hold. These are the same screen twice, pointed opposite
              ways, and both are sorted by how late something is rather than when it arrived.
            </>
          }
        />
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DueColumn
          title="Owed to you"
          total="$8,360.00"
          rows={OWED_TO_YOU}
          note="Comes free with Commerce, B2B or Invoicing — this half you already have."
        />
        <DueColumn
          title="Bills to pay"
          total="$4,458.44"
          rows={YOU_OWE}
          note="The half nothing else in your business was keeping. Mark one paid from the row itself."
        />
      </div>
    </Section>
  );
}

function DueColumn({
  title,
  total,
  rows,
  note,
}: {
  title: string;
  total: string;
  rows: DueRow[];
  note: string;
}) {
  return (
    <Card>
      <CardBody className="gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <Heading level={3} size={4}>
            {title}
          </Heading>
          <span className="text-2xl font-medium tabular-nums">{total}</span>
        </div>
        <div className="flex flex-col">
          {rows.map((row) => (
            <div
              key={row.who}
              className="border-base-200 flex items-center justify-between gap-4 border-t py-3.5 first:border-t-0"
            >
              <span className="flex min-w-0 flex-col">
                <Text as="span">{row.who}</Text>
                {/* Lateness is STATE, so it wears a semantic color and never the
                    module hue — and a row that is simply not due yet is a
                    genuinely untyped value, which is neutral's actual job
                    (DESIGN.md §3). */}
                {row.tone === 'neutral' ? (
                  <Text as="span" className="font-mono">
                    {row.when}
                  </Text>
                ) : (
                  <Badge color={row.tone} variant="soft" size="sm" className="mt-1 self-start">
                    {row.when}
                  </Badge>
                )}
              </span>
              <span className="shrink-0 font-medium tabular-nums">{row.amount}</span>
            </div>
          ))}
        </div>
        <Text className="border-base-300 border-t pt-4">{note}</Text>
      </CardBody>
    </Card>
  );
}
