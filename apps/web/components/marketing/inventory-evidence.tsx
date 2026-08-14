import { Heading, Text } from '@wizeworks/silicaui-react';
import { Section, SectionHeader } from './primitives';
import { M } from './inventory-ledger';

/**
 * /inventory — the two grounded sections (docs/146 §12.6).
 *
 * `InventoryEvidence` is the second half of beat 2: the reader has just been
 * told they check the shelf before they promise anything, and this says they are
 * the overwhelming majority rather than the careless exception. It is the only
 * place on the page carrying figures that are not sparx's own, so it is also the
 * only place carrying a citation.
 *
 * `InventoryParity` is the objection handler, placed after the resolution: "yes,
 * but will it actually do the things I need". It is the capability bar the whole
 * category has converged on (docs/146 §1), answered row by row — INCLUDING the
 * four rows where the answer is no.
 *
 * TWO RULES BIND EVERY WORD IN THIS FILE.
 *
 * 1. **No competitor is named, anywhere.** Not in the prose, not in the table,
 *    not in a comparison column. The category's convergence is described in our
 *    own language — a shipped artifact does not carry rivals' names. The one
 *    external reference is to a published SURVEY, cited so its figures can be
 *    checked, which is a different act from a competitive callout.
 * 2. **Every figure is dated and attributed, and no claim is rounded up.** The
 *    survey is a third party's, the sample size is stated, and the date it was
 *    checked against is on the page — because a marketing page arguing that you
 *    should be able to verify any number would be absurd if its own numbers were
 *    unverifiable. Anything that has NOT shipped appears in the "not this" group
 *    below and nowhere else: a wrong "yes" is a broken promise, and this table is
 *    where one would hide.
 */

// ── THE EVIDENCE (BEAT 2, SECOND HALF) ───────────────────────────────────────
//
// Six figures out of the survey table in docs/146 §2.1, chosen because each one
// maps onto a section this page goes on to make an argument about: spreadsheets
// → the setup beat, inaccuracy → the turn, stockouts → the buying beat, supplier
// reliability → the scorecard, shrinkage → the counting beat, AI → the assistant
// beat. Nothing here is a statistic for texture.

const FIGURES: { n: string; l: string }[] = [
  {
    n: '85%',
    l: 'still run their stock on spreadsheets — including half of the businesses with 500 or more staff',
  },
  { n: '44.8%', l: 'name inaccurate stock data as one of their biggest problems' },
  { n: '44%', l: 'run out of something at least once a month' },
  { n: '52%', l: 'name supplier reliability as one of their biggest problems' },
  { n: '80%', l: 'lose between 1% and 5% of their stock a year and mostly cannot say to what' },
  { n: '81% / 11%', l: 'want AI somewhere in how they run stock · have any of it today' },
];

export function InventoryEvidence() {
  return (
    <Section id="the-evidence" surface="dark" padding="lg">
      <div className="max-w-[820px]">
        <SectionHeader
          accent={M.ink}
          headline={<>It is not just you, and it is not carelessness</>}
          lede={
            <>
              An independent survey of 400 people who run stock for a living, published in 2026,
              found that the overwhelming majority still keep it in a spreadsheet — and that the
              thing they complain about is not missing features. It is that the number is wrong, the
              supplier is late, and nobody can tell them why.
            </>
          }
        />
      </div>

      <div className="mt-14 grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {FIGURES.map((f) => (
          <div key={f.n}>
            <div className="font-sans text-[clamp(36px,5vw,54px)] leading-none font-medium tracking-[-0.03em]">
              {f.n}
            </div>
            <Text className="mt-3 max-w-[34ch] text-sm">{f.l}</Text>
          </div>
        ))}
      </div>

      {/* The citation is not fine print — it is the thing that makes the six
          figures above worth more than assertion, on a page whose entire
          argument is that you should be able to check a number. */}
      <div className="border-base-300 mt-14 border-t pt-8">
        <Text className="max-w-[74ch] text-sm">
          Figures from{' '}
          <a
            className="underline underline-offset-4"
            href="https://www.inflowinventory.com/blog/state-of-inventory-management-2026/"
            rel="noopener noreferrer"
            target="_blank"
          >
            the State of Inventory Management 2026 survey
          </a>
          , a study of 400 operators published in 2026 by a company that is not us. Checked against
          the published report on 13 August 2026. They are somebody else’s research about the whole
          category, not our customer data, and we would rather cite a number you can go and read
          than invent one you cannot.
        </Text>
      </div>
    </Section>
  );
}

// ── THE PARITY TABLE ─────────────────────────────────────────────────────────
//
// Every row in the first four groups is verified live in the product as of
// 2026-08-13 against docs/89 §9 and the phase checklists in docs/146 §6 — not
// against the marketing copy, which is how a table like this normally rots. The
// fifth group is the reason the other four can be believed.

interface ParityRow {
  what: string;
  detail: string;
}

interface ParityGroup {
  title: string;
  rows: ParityRow[];
}

const HAVE: ParityGroup[] = [
  {
    title: 'The number itself',
    rows: [
      {
        what: 'Live stock by item and by place',
        detail: 'With every change that produced it kept, permanently, and readable by you.',
      },
      {
        what: 'Many locations, and shelves inside them',
        detail:
          'Zones, aisles, racks and shelf positions, walked in pick order rather than A to Z.',
      },
      {
        what: 'Barcodes on everything, scanned from a phone',
        detail:
          'Receiving, put-away, picking, counting, transfers and lookups. No handheld to buy.',
      },
      {
        what: 'Any quantity taken apart on demand',
        detail:
          'Back to the day it was last counted, with a name against every line. This is the part almost nothing else in the category can do.',
      },
    ],
  },
  {
    title: 'Getting stock in, and out again',
    rows: [
      {
        what: 'Purchase orders, receiving, and the real cost of a delivery',
        detail:
          'Freight and duty shared across the lines, so a part costs what it cost to get here.',
      },
      {
        what: 'Pick lists, batch and wave picking, pack verification',
        detail:
          'A guided walk that refuses the wrong shelf, and a box that refuses the wrong item.',
      },
      {
        what: 'Kits, recipes and build orders',
        detail:
          'What a thing is made of, how many you could build today, and running the build itself.',
      },
      {
        what: 'Buy by the case, stock by the each, sell by the pair',
        detail: 'One number underneath, however each part of the business prefers to count it.',
      },
      {
        what: 'Batches, expiry dates and serial numbers',
        detail:
          'Oldest-expiring picked first, and a recall handled as a process rather than a panic.',
      },
      {
        what: 'Counting on a schedule, plus full and blind counts',
        detail:
          'Cadence driven by what an item is worth and how predictable it is, with an approval gate on a costly variance.',
      },
    ],
  },
  {
    title: 'The money and the maths',
    rows: [
      {
        what: 'Moving average, FIFO layers, or standard cost',
        detail:
          'Your choice, per business and per item, on a screen that explains what each is for.',
      },
      {
        what: 'Forecasts and reorder points that move',
        detail:
          'Derived from what actually sells, how long a supplier really takes, and the time of year — recomputed nightly.',
      },
      {
        what: 'Valuation, turnover, ageing, dead stock, shrinkage, sell-through, fill rate',
        detail:
          'Nineteen reports, every one exportable and schedulable, every export re-importable.',
      },
      {
        what: 'Buying in another currency',
        detail:
          'Converted at the rate on the day the goods landed, and stored alongside the original.',
      },
    ],
  },
  {
    title: 'Everything it has to touch',
    rows: [
      {
        what: 'Selling channels and marketplaces kept in step',
        detail:
          'Eleven of them, each with a cushion you set per channel so one cannot oversell you.',
      },
      {
        what: 'Suppliers with lead times, minimums, price breaks and a track record',
        detail: 'Measured from your own deliveries rather than from what the price list promised.',
      },
      {
        what: 'Roles, a full audit trail, and an open API',
        detail:
          'Including a warehouse role that can do the work and cannot see a cost price. 337 endpoints, documented.',
      },
      {
        what: 'Journal entries and a reconciliation your accountant can check',
        detail:
          'Stock and cost-of-sale journals, and a reconciliation that names each ordinary timing difference rather than netting them into one figure.',
      },
    ],
  },
];

const HAVE_NOT: ParityRow[] = [
  {
    what: 'It is not a set of books',
    detail:
      'There is no general ledger here and no chart of accounts, and there is not going to be. sparx produces the journals and the reconciliation; your accounting package and your accountant keep the books, and both are better at it than we would be.',
  },
  {
    what: 'The direct accounting connection is built, not switched on',
    detail:
      'The QuickBooks Online and Xero connectors are complete, but this installation has no app registered with either vendor yet — so the screen tells you that and offers the export that works today, rather than a button that dies at the redirect.',
  },
  {
    what: 'It is not on an EDI network',
    detail:
      'You can receive against a supplier’s advance shipping notice, but somebody enters or uploads it. sparx does not consume EDI transaction sets and does not yet give suppliers an endpoint of their own to post to.',
  },
  {
    what: 'It will not schedule a factory',
    detail:
      'Recipes and build runs are here, and they move real stock. Production scheduling, machine capacity planning and shop-floor routing are not — that is a different product, and pretending otherwise would waste a manufacturer’s afternoon.',
  },
];

export function InventoryParity() {
  return (
    <Section id="the-list" padding="lg">
      <div className="max-w-[860px]">
        <SectionHeader
          accent={M.ink}
          headline={<>Everything the category agreed you need — and the four things this isn’t</>}
          lede={
            <>
              Stock software has converged on a fairly settled list of what a serious system has to
              do. Here is that list, answered honestly, as of August 2026. The last group is the
              important one: a page where every row is a yes has told you nothing, and the fastest
              way to find out whether a product is honest about what it does is to see whether it
              will say what it doesn’t.
            </>
          }
        />
      </div>

      <div className="mt-14 flex flex-col gap-12">
        {HAVE.map((group) => (
          <div key={group.title}>
            <Heading level={3} size={3}>
              {group.title}
            </Heading>
            <div className="border-base-300 mt-6 grid grid-cols-1 gap-x-10 border-t sm:grid-cols-2">
              {group.rows.map((row) => (
                <div key={row.what} className="border-base-200 border-b py-5">
                  <Text as="span" className="font-medium">
                    {row.what}
                  </Text>
                  <Text className="mt-1.5 max-w-[52ch]">{row.detail}</Text>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* The honest group. It is a `surface` island inside a `page` section so
            it reads as a deliberate change of register rather than a fifth
            heading somebody might skim past — this is the group a careful buyer
            came for. */}
        <div className="bg-base-100 rounded-2xl p-8 sm:p-12">
          <Heading level={3} size={3}>
            And four things it deliberately is not
          </Heading>
          <Text className="mt-4 max-w-[62ch]">
            Each of these is a real boundary rather than a roadmap item we are being coy about. If
            one of them is what you came for, we would rather you found out here than three weeks
            into a migration.
          </Text>
          <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-2">
            {HAVE_NOT.map((row) => (
              <div key={row.what}>
                <Text as="span" className="font-medium">
                  {row.what}
                </Text>
                <Text className="mt-1.5 max-w-[52ch]">{row.detail}</Text>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
