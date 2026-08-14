import { Badge, Card, CardBody, Heading, Text } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Section, SectionHeader } from './primitives';
import { M, flowTone, type Flow } from './inventory-ledger';
import { signupHref } from './cta';

/**
 * /inventory, beats 3 and 4 — the false fix and the turn — plus the first two
 * consequences (it shows its working, it checks itself). The remaining
 * consequences and the resolution live in `inventory-floor.tsx`; the evidence
 * and parity bands in `inventory-evidence.tsx`; the page shell and its story map
 * in `inventory-page.tsx`.
 *
 * ONE WORKED EXAMPLE RUNS THROUGH EVERY DEVICE ON THIS PAGE: a coffee roastery
 * with a roastery, a warehouse and a wholesale book, and one item inside it —
 * Guji Natural, 1kg. It counted 120 on 14 February, took three deliveries, sold
 * 312, had 9 come back and 6 arrive broken, so it holds 51 and can promise 41.
 * Every figure in every section reconciles to those, deliberately: a page whose
 * argument is "you can add this up yourself" and whose own columns do not add up
 * is arguing against itself, and the reader who checks one column is exactly the
 * reader this module is for.
 */

// ── BEAT 3 · THE FALSE FIX ───────────────────────────────────────────────────
//
// The move is NOT "stock software is bad" — it is that the software is doing
// exactly what it promised and still leaves you with nowhere to go on the one
// morning it matters. Conceding the sync is what buys the turn its credibility a
// section later, and it is also just true: real-time multichannel sync is the
// thing the whole category converged on (docs/146 §1) and it is table stakes
// here too. The gap is the SECOND question, which nothing in the category
// answers: not "what is the number" but "why is it that, and where did it go
// wrong".

/** What a stock system tells you, correctly, every fifteen minutes. */
const DASHBOARD: { label: string; value: string }[] = [
  { label: 'Guji Natural — 1kg', value: '41' },
  { label: 'Kenya Peaberry — 1kg', value: '18' },
  { label: 'House Espresso — 1kg', value: '206' },
  { label: 'Decaf Colombia — 250g', value: '64' },
];

export function InventoryFalseFix() {
  return (
    <Section id="the-morning" padding="lg">
      <div className="max-w-[860px]">
        <SectionHeader
          headline={<>So you buy a stock system, and it is confidently wrong by Tuesday</>}
          lede={
            <>
              Not a bad one. It syncs every channel every few minutes, it emails you when something
              runs low, and the dashboard is genuinely accurate most of the time. Then one morning
              the shelf has thirty-three bags on it and the screen says forty-one, and the whole
              product has nothing to say about which of the two is lying.
            </>
          }
        />
      </div>

      <div className="mt-14 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {/* Correct, current, and useless on the one morning it matters. */}
        <Card>
          <CardBody className="gap-5">
            <div className="flex items-baseline justify-between gap-4">
              <Heading level={3} size={4}>
                What the screen says
              </Heading>
              <Badge color="success" size="sm">
                Synced 4 min ago
              </Badge>
            </div>
            <div className="flex flex-col">
              {DASHBOARD.map((row, i) => (
                <div
                  key={row.label}
                  className={[
                    'flex items-baseline justify-between gap-6 py-2.5',
                    i === 0 ? '' : 'border-base-200 border-t',
                  ].join(' ')}
                >
                  <Text as="span">{row.label}</Text>
                  <span className="shrink-0 text-xl font-medium tabular-nums">{row.value}</span>
                </div>
              ))}
            </div>
            <Text>
              Every one of those is a single stored number, overwritten by whichever system spoke
              last. It is right far more often than it is wrong, which is exactly what makes the
              wrong ones expensive — you have no reason to doubt any particular one of them.
            </Text>
          </CardBody>
        </Card>

        {/* The question the category does not answer. */}
        <Card>
          <CardBody className="gap-5">
            <Heading level={3} size={4}>
              What you need to know at 8am
            </Heading>
            <Heading level={4} size={3} className="max-w-[20ch]">
              “Where did the other eight bags go?”
            </Heading>
            <Text>
              And there is no screen for that. There is a number, an audit log that records that the
              number changed from 49 to 41 at 06:12 by “System”, and a support article suggesting a
              full recount. So you shut the aisle, count four hundred lines to find eight bags, and
              write the new figure over the old one — which puts you back exactly where you started,
              with a number you have no way to check.
            </Text>
            <Text>
              A week later the same thing happens on a different item, and by then nobody promises a
              customer anything without walking to the shelf first. That habit is what a stock
              system was bought to end.
            </Text>
            <div className="border-base-300 flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-5">
              <Badge color="error" size="sm">
                6 broken on arrival
              </Badge>
              <Text as="span">
                is where they went, on the delivery that landed on the 4th. The next section can say
                that.
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
// The one section on the page painted in Inventory's own hue (DESIGN.md §2.5),
// at the one moment the page makes an argument nothing else in the category can
// make: on-hand is not a field. It is `Σ(movements.delta)` over an append-only
// ledger with exactly one writer, which is the binding architectural commitment
// this module was built on (docs/146 §0) and the reason every claim further down
// the page is possible at all.
//
// No <Spark> and no <SectionHeader>: a `text-module-inventory` full stop on a
// `bg-module-inventory` field is amber on amber, and at the standard h2 size the
// climax reads quieter than the sections it pays off. Same reasoning as
// FinanceTurn and CrmTurn.
export function InventoryTurn() {
  const beats: { title: string; body: string }[] = [
    {
      title: 'Nothing overwrites the total',
      body: 'A delivery, a sale, a count, a breakage, a transfer between your own places — each one is written down as its own line and none of them edits a running figure. There is exactly one way stock is allowed to move, so there is exactly one place it can have gone.',
    },
    {
      title: 'So the total can always be redone',
      body: 'Which means no quantity on any screen is ever just an assertion. Ask it why and it adds itself up again in front of you, back to the morning somebody last walked to the shelf and counted — with a name against every line that moved it.',
    },
    {
      title: 'And we redo it every night, without being asked',
      body: 'The sum is worth nothing if nobody ever checks it against the number on the screen. So sparx checks all of them, every night, and tells you the morning they stop agreeing — rather than leaving you to discover it from a customer four weeks later.',
    },
  ];
  return (
    <Section id="the-turn" surface="module" module="inventory" padding="lg">
      <h2 className="max-w-[20ch] text-[clamp(34px,5vw,64px)] leading-[1.03] font-medium tracking-[-0.03em] sm:max-w-none">
        On hand is not a number we keep. It is a sum we can always do again.
      </h2>
      <p className="mt-7 max-w-[880px] text-2xl leading-[1.45]">
        Almost every stock system in the world stores one figure per item per place and edits it as
        things happen. That is why none of them can tell you where eight bags went: the moment the
        number changed, the thing it used to be stopped existing. sparx never stores that figure at
        all. It stores what happened, and works the figure out — which is a slower thing to build
        and the only thing that makes an answer possible.
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
          near-black `neutral` on Inventory amber. An outline or ghost button
          would ink itself from the LIGHT theme and land near-black by accident. */}
      <div className="mt-14 flex flex-wrap items-center gap-x-7 gap-y-4">
        <a
          href={signupHref('inventory-turn')}
          className={buttonClasses({ color: 'neutral', size: 'xl' })}
        >
          Switch Inventory on →
        </a>
        <p className="text-md">
          $29 a month, unlimited users. Free if you sell with Commerce or B2B.
        </p>
      </div>
    </Section>
  );
}

// ── BEAT 5a · IT SHOWS ITS WORKING ───────────────────────────────────────────
//
// The chain of consequences starts here because everything after it is only
// believable once the reader has seen the evidence one layer down. The hero
// showed the SUMMARY of the derivation; this shows the rows behind it, which is
// where the surprising details live.
//
// The short pick is in the list on purpose. Units nobody could find were never
// picked, so the sale that removed them has not happened and they go back
// on-hand (docs/146 Phase 4) — a movement that goes UP for a reason that sounds
// like a loss. It is the single best two-line proof that this is a real ledger
// from a real warehouse rather than a marketing mock-up, and a reader who runs a
// warehouse will recognise it immediately.

interface MovementRow {
  when: string;
  what: string;
  who: string;
  delta: string;
  flow: Flow;
  after: string;
}

const MOVEMENTS: MovementRow[] = [
  {
    when: 'Sat 07:52',
    what: 'Sold · order #4482 · website',
    who: 'Checkout',
    delta: '−2',
    flow: 'out',
    after: '51',
  },
  {
    when: 'Fri 16:20',
    what: 'Sold · 6 wholesale orders',
    who: 'Checkout',
    delta: '−18',
    flow: 'out',
    after: '53',
  },
  {
    when: 'Fri 11:04',
    what: 'Delivered · PO-2214 · Lindeman Green',
    who: 'Tom, at the door',
    delta: '+60',
    flow: 'in',
    after: '71',
  },
  {
    when: 'Fri 09:31',
    what: 'Came back · order #4390',
    who: 'Ana',
    delta: '+2',
    flow: 'in',
    after: '11',
  },
  {
    when: 'Thu 15:10',
    what: 'Short pick · aisle B, shelf 3',
    who: 'Maya, on a phone',
    delta: '+1',
    flow: 'in',
    after: '9',
  },
  {
    when: 'Thu 14:55',
    what: 'Sold · order #4477 · website',
    who: 'Checkout',
    delta: '−4',
    flow: 'out',
    after: '8',
  },
];

export function InventoryProvenance() {
  return (
    <Section id="showing-its-working" surface="surface" padding="lg">
      <div className="max-w-[860px]">
        <SectionHeader
          accent={M.ink}
          headline={<>Every number opens</>}
          lede={
            <>
              Click a quantity on the stock list, on a product, on a purchase order, on the shelf
              card, or in your storefront’s own availability check — the same drawer opens, with the
              same rows in it. Each one names what happened, when, and who or what caused it, and
              carries the balance it left behind, so you can follow the number down the page and
              watch it arrive at what the screen is showing you.
            </>
          }
        />
      </div>

      <div className="mt-14 grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardBody className="gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
              <Heading level={3} size={4}>
                Guji Natural — 1kg · Warehouse
              </Heading>
              <Text as="span" className="font-mono">
                last 6 of 1,290
              </Text>
            </div>

            {/* A ledger read newest-first, with the balance each row left behind
                — the shape the real movements surface uses. The balance column
                is what makes it checkable: the reader can walk it upward and see
                the arithmetic close. */}
            <div className="flex flex-col">
              {MOVEMENTS.map((row, i) => (
                <div
                  key={row.when}
                  className={[
                    'flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3',
                    i === 0 ? '' : 'border-base-200 border-t',
                  ].join(' ')}
                >
                  <span className="flex min-w-0 flex-col">
                    <Text as="span">{row.what}</Text>
                    <Text as="span" className="font-mono">
                      {row.when} · {row.who}
                    </Text>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-6">
                    <span className={`${flowTone(row.flow)} font-medium tabular-nums`}>
                      {row.delta}
                    </span>
                    <span className="min-w-[4ch] text-right tabular-nums">{row.after}</span>
                  </span>
                </div>
              ))}
            </div>

            <Text className="border-base-300 border-t pt-4">
              The third row up is worth a second look. A picker could not find one bag, said so on
              her phone, and the bag went <span className="font-medium">back on hand</span> —
              because a unit nobody could find was never picked, so the sale that removed it has not
              happened yet. It is also now reserved for the order still waiting on it, and that
              shelf has been put on a count.
            </Text>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardBody className="gap-3">
              <Heading level={3} size={4}>
                Who, not just what
              </Heading>
              <Text>
                Every line records whether it was a person, a scheduled job, another system, or an
                AI assistant that caused it, and what it was acting on — an order number, a
                delivery, a count sheet. “It changed at 06:12 by System” is not an answer, and it is
                the answer most audit logs give.
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="gap-3">
              <Heading level={3} size={4}>
                Take the whole thing with you
              </Heading>
              <Text>
                Any view of this history downloads as a spreadsheet, filtered exactly the way the
                screen was filtered, and it tells you plainly when there was more than it gave you
                rather than quietly stopping at ten thousand rows. Your history is yours, in a file
                anything can open.
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="gap-3">
              <Heading level={3} size={4}>
                Nobody can edit it
              </Heading>
              <Text>
                Not you, not us, not an integration, not a script. A mistake is corrected by writing
                the correction down, so the record of what you believed and when you stopped
                believing it survives. That is what makes the file above worth anything in an
                argument with a supplier or an insurer.
              </Text>
            </CardBody>
          </Card>
        </div>
      </div>
    </Section>
  );
}

// ── BEAT 5b · IT CHECKS ITSELF ───────────────────────────────────────────────
//
// The escalation from 5a: showing its working is passive — the reader has to
// come and look. This is the same evidence, checked on a schedule, whether or
// not anybody is watching.
//
// THE RULE THIS SECTION EXISTS TO STATE is docs/146's governing one: absence
// must never be presented as a measurement, and a silent auto-correction is the
// worst version of that — it destroys the only evidence of what went wrong while
// leaving a screen that looks healthy. So the verdict card leads with the LAST
// RUN rather than a green tick, and the second card is about what happens when
// the answer is not zero.

const VERDICT: { label: string; value: string; tone?: string }[] = [
  { label: 'Last re-added', value: '04:31 today' },
  { label: 'Stock lines checked', value: '4,812' },
  { label: 'Disagreements found', value: '0', tone: 'text-success' },
  { label: 'Value in question', value: '$0.00', tone: 'text-success' },
  { label: 'Clean nights in a row', value: '61' },
];

export function InventoryIntegrity() {
  return (
    <Section id="checks-itself" padding="lg">
      <div className="max-w-[860px]">
        <SectionHeader
          accent={M.ink}
          headline={<>It re-adds every number in the building while you sleep</>}
          lede={
            <>
              At half past four every morning sparx takes every item in every location, adds its
              entire history back up from scratch, and compares the answer to the figure it has been
              showing you all week. Two numbers derived two different ways: if they ever disagree,
              something is wrong, and you find out from a screen at breakfast rather than from a
              customer in six weeks.
            </>
          }
        />
      </div>

      <div className="mt-14 grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_1.15fr]">
        <Card>
          <CardBody className="gap-4">
            <Heading level={3} size={4}>
              Last night’s check
            </Heading>
            <div className="flex flex-col">
              {VERDICT.map((row, i) => (
                <div
                  key={row.label}
                  className={[
                    'flex items-baseline justify-between gap-6 py-3',
                    i === 0 ? '' : 'border-base-200 border-t',
                  ].join(' ')}
                >
                  <Text as="span">{row.label}</Text>
                  <span
                    className={['shrink-0 text-xl font-medium tabular-nums', row.tone ?? '']
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
            <Text className="border-base-300 border-t pt-4">
              Sixty-one is a real thing to be proud of and a real thing to lose. That is why it is
              on the screen: a streak you can break is a number people look after.
            </Text>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardBody className="gap-3">
              <Heading level={3} size={4}>
                And when it isn’t zero, it does not tidy up
              </Heading>
              <Text>
                A drifted number is evidence. sparx names the items, says what the difference is
                worth, and leaves both figures exactly where they are for you to look at — because a
                system that silently writes the “correct” value over the top has destroyed the only
                trace of whatever caused it, and handed you a screen that looks healthy for the
                second time.
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="gap-3">
              <Heading level={3} size={4}>
                Every oversell is written down
              </Heading>
              <Text>
                Three different things get muddled into “we oversold”: an order sparx refused, an
                order it let through against a cushion you set, and stock that actually went below
                zero. Each is recorded separately, with what the system believed at the moment it
                decided — so “are we overselling?” has an answer with a count on it.
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="gap-3">
              <Heading level={3} size={4}>
                Numbers carry their age
              </Heading>
              <Text>
                If a figure comes from another system — a warehouse you don’t run, a shop floor
                till, an ERP — you tell sparx how often it should hear from it. When it goes quiet
                the number is flagged as old on every screen it appears on, and you choose what
                happens: warn you, hold a bit more back, or stop selling that stock until it speaks
                again.
              </Text>
            </CardBody>
          </Card>
        </div>
      </div>
    </Section>
  );
}
