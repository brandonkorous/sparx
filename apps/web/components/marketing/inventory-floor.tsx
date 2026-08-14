import { Badge, Card, CardBody, Heading, Text } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Dot, Section, SectionHeader } from './primitives';
import { M } from './inventory-ledger';
import { signupHref } from './cta';

/**
 * /inventory, the rest of beat 5 and beat 6 — it walks the floor, it tells you
 * what to buy, it answers questions, and then you were running by the end of the
 * afternoon. Beats 3–5b are in `inventory-sections.tsx`; the evidence and parity
 * bands in `inventory-evidence.tsx`; the shell in `inventory-page.tsx`.
 *
 * The ORDER of these is the argument, which is why they are not a feature grid.
 * Each one is only possible because of the one before it: you can only direct a
 * picker to a shelf if the system knows what is on that shelf; you can only tell
 * someone what to buy if the demand history behind the number is trustworthy;
 * an assistant can only be allowed near any of it once every number it reads can
 * be checked. A menu of the same six capabilities would say none of that.
 */

// ── BEAT 5c · IT WALKS THE FLOOR WITH YOU ────────────────────────────────────
//
// The escalation: 5a and 5b were about a record. This is the first section where
// the module leaves the screen and tells a person where to stand, which is also
// where accuracy is actually won or lost (docs/146 §4, P2 — scanning is the #1
// accuracy lever in the field).
//
// The guided pick is shown as SHELF FIRST, then item, then quantity, in that
// order of size, because the first question in an aisle is always "am I in the
// right place" (docs/146 Phase 4.3). That ordering is a real product decision,
// so the mock-up has to honour it or the page is advertising something else.

const WALK: { shelf: string; item: string; qty: string; state: 'done' | 'here' | 'next' }[] = [
  { shelf: 'A · 02 · 1', item: 'House Espresso — 1kg', qty: '6', state: 'done' },
  { shelf: 'B · 03 · 2', item: 'Guji Natural — 1kg', qty: '2', state: 'here' },
  { shelf: 'B · 07 · 4', item: 'Kenya Peaberry — 1kg', qty: '1', state: 'next' },
  { shelf: 'C · 01 · 3', item: 'Decaf Colombia — 250g', qty: '4', state: 'next' },
];

export function InventoryFloor() {
  return (
    <Section id="the-floor" surface="surface" padding="lg">
      <div className="max-w-[860px]">
        <SectionHeader
          accent={M.ink}
          headline={<>The shelf, the phone, and the person actually standing there</>}
          lede={
            <>
              A number is only ever as good as the last time somebody touched the stock behind it.
              So everything that happens on the floor happens through a phone camera: receiving a
              delivery, putting it away, walking a pick, counting a shelf, moving stock between your
              own places. No handheld to buy, no app store, no training day — it is the camera they
              already carry, and it refuses the wrong item rather than trusting anyone to notice.
            </>
          }
        />
      </div>

      <div className="mt-14 grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* The walk, shelf-first. Deliberately a still rather than an
            interactive mock: a screen a visitor cannot actually scan into is
            better honest than fake. */}
        <Card>
          <CardBody className="gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
              <Heading level={3} size={4}>
                Pick walk · 4 stops
              </Heading>
              <Text as="span" className="font-mono">
                Maya · 3 orders
              </Text>
            </div>
            <div className="flex flex-col">
              {WALK.map((stop, i) => (
                <div
                  key={stop.shelf}
                  className={[
                    'flex items-center justify-between gap-4 py-3.5',
                    i === 0 ? '' : 'border-base-200 border-t',
                  ].join(' ')}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Dot
                      fill={
                        stop.state === 'done'
                          ? 'bg-success'
                          : stop.state === 'here'
                            ? M.bg
                            : 'bg-base-300'
                      }
                      size={9}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span
                        className={[
                          'font-mono tabular-nums',
                          stop.state === 'here' ? 'text-2xl font-medium' : 'text-md',
                        ].join(' ')}
                      >
                        {stop.shelf}
                      </span>
                      <Text as="span">{stop.item}</Text>
                    </span>
                  </span>
                  <span className="shrink-0 text-xl font-medium tabular-nums">×{stop.qty}</span>
                </div>
              ))}
            </div>
            <div className="border-base-300 flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-4">
              <Badge color="error" size="sm">
                Wrong shelf
              </Badge>
              <Text as="span">
                is what a scan at B · 07 · 4 gets right now — and it says which aisle to go to
                instead.
              </Text>
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Card>
            <CardBody className="gap-3">
              <Heading level={3} size={4}>
                Shelves, not just buildings
              </Heading>
              <Text>
                Zones, aisles, racks and shelves inside each location, sorted by the order somebody
                actually walks them rather than alphabetically. Print labels in three sizes; the
                code is in the label itself, so it still scans in the back corner where the wifi
                does not reach.
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="gap-3">
              <Heading level={3} size={4}>
                Counting on a schedule
              </Heading>
              <Text>
                Decide that the fast-moving, high-value lines get counted monthly and the long tail
                twice a year, and sparx tells you what is due. Count blind — no expected figure on
                the screen — and a variance worth real money waits for someone to approve it before
                it posts.
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="gap-3">
              <Heading level={3} size={4}>
                Batches, dates and recalls
              </Heading>
              <Text>
                Track a batch or an individual serial number from the delivery that brought it in to
                the order that took it out. Oldest-expiring goes first, automatically, and a recall
                is a workflow rather than an afternoon with a spreadsheet and a phone.
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="gap-3">
              <Heading level={3} size={4}>
                Boxes that can’t go wrong
              </Heading>
              <Text>
                Scan every item into the box; anything not on the order is refused. Split an order
                across three parcels and it is three tracking numbers, not an exception you handle
                by hand. The packing slip prints with a tick against each verified line.
              </Text>
            </CardBody>
          </Card>
        </div>
      </div>
    </Section>
  );
}

// ── BEAT 5d · IT TELLS YOU WHAT TO BUY ───────────────────────────────────────
//
// The next escalation, and the first section where the module stops reporting
// and starts advising. It can only do that because of everything above it: a
// reorder point derived from demand history is worth exactly as much as the
// history is trustworthy, which is the argument the first half of the page
// spent its time making.
//
// Two things here are deliberate and both come from docs/146's governing rule
// that a guess must never be indistinguishable from a fact. The cover column
// shows a real date rather than a traffic light, and the item with plenty of
// stock shows an em dash rather than a reassuring zero — a number nobody
// computed must never render as one.

interface ReorderRow {
  item: string;
  cover: string;
  stockout: string;
  atRisk: string;
  buy: string;
  tone: 'error' | 'warning' | 'none';
}

const REORDER: ReorderRow[] = [
  {
    item: 'Kenya Peaberry — 1kg',
    cover: '2 days',
    stockout: 'Fri 20 Feb',
    atRisk: '$1,880',
    buy: '90',
    tone: 'error',
  },
  {
    item: 'Guji Natural — 1kg',
    cover: '6 days',
    stockout: 'Tue 24 Feb',
    atRisk: '$3,140',
    buy: '120',
    tone: 'warning',
  },
  {
    item: 'House Espresso — 1kg',
    cover: '31 days',
    stockout: '—',
    atRisk: '—',
    buy: '—',
    tone: 'none',
  },
];

const SCORECARD: { label: string; value: string; tone?: string }[] = [
  { label: 'Turned up on time', value: '62%', tone: 'text-error' },
  { label: 'Of the order actually sent', value: '94%' },
  { label: 'Lead time quoted / real', value: '14 → 21 days', tone: 'text-error' },
  { label: 'Quoted price vs billed', value: '+$0.55 / kg', tone: 'text-error' },
];

export function InventoryBuying() {
  return (
    <Section id="what-to-buy" padding="lg">
      <div className="max-w-[860px]">
        <SectionHeader
          accent={M.ink}
          headline={<>What to buy this morning, and who has been letting you down</>}
          lede={
            <>
              A reorder point typed in last spring is a guess that has stopped being true. sparx
              works yours out from what actually sells, how long each supplier really takes rather
              than what they promised, and what time of year it is — then puts the consequence next
              to it in money, because “low stock” is not a reason to spend three thousand dollars
              and “you lose $3,140 next Tuesday” is.
            </>
          }
        />
      </div>

      <div className="mt-14 grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardBody className="gap-4">
            <Heading level={3} size={4}>
              Needs buying
            </Heading>
            {/* A table, not a card grid: five columns of like-for-like figures
                are a table, and a reader compares them by scanning down. */}
            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-base-300 border-b">
                    <th className="w-full py-2 pr-4 font-medium">Item</th>
                    <th className="py-2 pr-4 text-right font-medium whitespace-nowrap">Cover</th>
                    <th className="py-2 pr-4 text-right font-medium whitespace-nowrap">Runs out</th>
                    <th className="py-2 pr-4 text-right font-medium whitespace-nowrap">At risk</th>
                    <th className="py-2 text-right font-medium whitespace-nowrap">Buy</th>
                  </tr>
                </thead>
                <tbody>
                  {REORDER.map((row) => (
                    <tr key={row.item} className="border-base-200 border-b last:border-b-0">
                      <td className="max-w-0 truncate py-3 pr-4">
                        <Text as="span">{row.item}</Text>
                      </td>
                      <td className="py-3 pr-4 text-right whitespace-nowrap">
                        {row.tone === 'none' ? (
                          <Text as="span" className="tabular-nums">
                            {row.cover}
                          </Text>
                        ) : (
                          <Badge color={row.tone} size="sm" className="tabular-nums">
                            {row.cover}
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right whitespace-nowrap tabular-nums">
                        {row.stockout}
                      </td>
                      <td className="py-3 pr-4 text-right font-medium whitespace-nowrap tabular-nums">
                        {row.atRisk}
                      </td>
                      <td className="py-3 text-right font-medium whitespace-nowrap tabular-nums">
                        {row.buy}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Text className="border-base-300 border-t pt-4">
              The third row has thirty-one days of cover, so its last three columns are dashes
              rather than zeroes. Nothing computed a stockout date for it and nothing measured a
              risk, and a screen full of reassuring zeroes is how you learn to stop reading a
              column.
            </Text>
            <div className="flex flex-wrap items-center gap-3">
              <span className={buttonClasses({ color: 'module-inventory', size: 'md' })}>
                Draft the orders
              </span>
              <Text as="span">
                — grouped by supplier, net of what is already on its way, ready to check and send.
              </Text>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <Heading level={3} size={4}>
                Lindeman Green
              </Heading>
              <Text as="span" className="font-mono">
                last 12 months
              </Text>
            </div>
            <div className="flex flex-col">
              {SCORECARD.map((row, i) => (
                <div
                  key={row.label}
                  className={[
                    'flex items-baseline justify-between gap-4 py-3',
                    i === 0 ? '' : 'border-base-200 border-t',
                  ].join(' ')}
                >
                  <Text as="span">{row.label}</Text>
                  <span
                    className={['shrink-0 font-medium tabular-nums', row.tone ?? '']
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
            <Text className="border-base-300 border-t pt-4">
              Fifty-two out of a hundred businesses name supplier reliability as their biggest stock
              problem, and almost nothing in the category measures it. sparx does, from your own
              deliveries — and the twenty-one days it learned is the number your reorder points
              quietly start using, instead of the fourteen on the price list.
            </Text>
          </CardBody>
        </Card>
      </div>
    </Section>
  );
}

// ── BEAT 5e · IT ANSWERS QUESTIONS ───────────────────────────────────────────
//
// The last consequence and the top of the escalation: everything above is
// reachable by something that is not a person sitting at a screen.
//
// THE BYOK BOUNDARY IS NOT OPTIONAL COPY. sparx never runs an LLM on a platform
// credential — every AI capability is the tenant's own model, or their own AI
// client connecting to their own data. Any line here implying "sparx's AI" would
// be false and would also misprice the module. Dark rather than painted: amber
// is spent on the turn, and one identity band per page.
export function InventoryAssistant() {
  const points: { title: string; body: string }[] = [
    {
      title: 'Your assistant, your data',
      body: 'Connect the AI client you already use and it can read your stock the way a person would — what should I reorder, why did this drop, which supplier is slipping, what is expiring next month. The account is yours and the model is yours; sparx never runs one on your behalf.',
    },
    {
      title: 'It cannot spend your money',
      body: 'A hundred and forty-five tools, and everything that points money at somebody else is deliberately not one of them. An assistant can tell you your worst supplier is late on a third of its orders. It cannot approve the next purchase order, agree a price, or write off a batch.',
    },
    {
      title: 'Tell your other systems',
      body: 'Twenty-five things that happen to your stock can be sent to any address you name the moment they happen — something running low, a count coming up short, a delivery landing, a feed going quiet. Set it up on a screen, no developer needed.',
    },
    {
      title: 'Your columns, your words',
      body: 'Add fields sparx has never heard of to items, shelves, suppliers or purchase orders — a bond number, a customs code, a bay. They appear in the grid, in exports, and in the API alongside everything else.',
    },
  ];
  return (
    <Section id="ask-it" surface="dark" padding="lg">
      <div className="max-w-[820px]">
        <SectionHeader
          accent={M.ink}
          headline={<>And you can just ask it</>}
          lede={
            <>
              Eight in ten businesses say they want AI somewhere in how they run stock; about one in
              ten has any. The reason is not enthusiasm — it is that pointing a model at numbers
              nobody can verify produces confident nonsense. Everything on this page is the part
              that has to be true first.
            </>
          }
        />
      </div>
      <div className="mt-14 grid grid-cols-1 gap-x-10 gap-y-9 sm:grid-cols-2">
        {points.map((p) => (
          <div key={p.title}>
            <Heading level={3} size={4}>
              {p.title}
            </Heading>
            <Text className="mt-3 max-w-[46ch]">{p.body}</Text>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── BEAT 6 · RESOLUTION ──────────────────────────────────────────────────────
//
// Closes the loop the page opened. The incumbent this module actually competes
// with is a spreadsheet — 85% of operators are still on one (docs/146 §2.1) —
// so the resolution is not "look how much more it does", it is "you can be off
// the spreadsheet by this afternoon, and everyone can use it".
//
// The four steps are the real wizard (docs/146 Phase 11.1) in the order it runs
// them, and the thirty-minute figure is the target the wizard is instrumented
// against rather than a marketing round number. It is stated as a target on
// purpose: claiming it as a measured average would be exactly the kind of number
// this page spends its length arguing against.

const SETUP: { step: string; title: string; body: string }[] = [
  {
    step: 'First',
    title: 'Say where stock lives',
    body: 'A shop, a back room, a unit, a van, somebody else’s warehouse. One is a perfectly good answer, and you can add the rest later without redoing anything.',
  },
  {
    step: 'Then',
    title: 'Bring the sheet you already keep',
    body: 'Upload it as it is. sparx reads your column names and matches them to its own — “Qty on hand”, “QTY”, “stock” — and asks you about the ones it is unsure of rather than guessing.',
  },
  {
    step: 'Before anything changes',
    title: 'See exactly what it will do',
    body: '412 items created, 88 updated, 6 rows it cannot read and why. Nothing is written until you say so, and if the answer is “not like that” you fix the sheet and run it again.',
  },
  {
    step: 'Finally',
    title: 'Count it once, for real',
    body: 'The setup ends with an opening count, so day one is a number somebody walked out and verified — not an imported guess that everything afterwards inherits.',
  },
];

export function InventorySetup() {
  return (
    <Section id="getting-started" surface="surface" padding="lg">
      <div className="max-w-[860px]">
        <SectionHeader
          accent={M.ink}
          headline={<>You can be off the spreadsheet by the end of the afternoon</>}
          lede={
            <>
              The thing this actually replaces, for most businesses, is a spreadsheet — and the
              spreadsheet is winning for one honest reason: you can start using it in ten minutes
              and nobody has to be trained. So the setup is built to beat that, not to beat an
              enterprise feature list. Four steps, ending in a real count, with a thirty-minute
              target it is measured against.
            </>
          }
        />
      </div>

      <div className="mt-14 grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {SETUP.map((s) => (
          <div key={s.title} className="flex flex-col gap-3">
            <Text as="span" className="font-mono">
              {s.step}
            </Text>
            <Heading level={3} size={4}>
              {s.title}
            </Heading>
            <Text>{s.body}</Text>
          </div>
        ))}
      </div>

      <div className="border-base-300 mt-14 grid grid-cols-1 gap-6 border-t pt-12 lg:grid-cols-2">
        <div>
          <Heading level={3} size={3}>
            And everyone can use it
          </Heading>
          <Text className="mt-4 max-w-[52ch]">
            Nothing here is priced per person. Your pickers, receivers and counters all get an
            account, and there is a role built for exactly them: it can receive a delivery, enter a
            count, move stock and look things up, and it cannot see a single cost price. The
            accuracy of your stock should not depend on how few people you could afford to let near
            it.
          </Text>
        </div>
        <div>
          <Heading level={3} size={3}>
            And you can leave
          </Heading>
          <Text className="mt-4 max-w-[52ch]">
            Every list, every report and the entire movement history downloads as a spreadsheet from
            a button, without a support ticket and without asking anyone — and every export sparx
            produces imports back into sparx unchanged, which is the only test of an export that
            means anything. A record you cannot take with you is not really yours.
          </Text>
        </div>
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-3">
        <a
          href={signupHref('inventory-setup')}
          className={buttonClasses({ color: 'module-inventory', size: 'xl' })}
        >
          Start free →
        </a>
        <a href="#the-turn" className={buttonClasses({ size: 'xl', variant: 'outline' })}>
          Why the number can be trusted
        </a>
      </div>
    </Section>
  );
}
