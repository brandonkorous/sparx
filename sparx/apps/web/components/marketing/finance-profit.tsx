import { Badge, Card, CardBody, Heading, Text } from '@wizeworks/silicaui-react';
import { Section, SectionHeader } from './primitives';
import { costFill, costTone, M, MoneyRow, MarginBadge, netTone } from './finance-money';

/**
 * /finance, the back half — beats 5c and 5d (it answers, it ranks), then the
 * resolution: the accounting handoff and the capability sweep. The front half
 * and the story map live in `finance-sections.tsx` / `finance-page.tsx`.
 *
 * Every figure reconciles to the same worked March a sign shop had: sales
 * $48,210, cost of the work $19,640, wages $14,300, running costs $6,180, kept
 * $8,090. See the note at the top of finance-sections.tsx.
 */

// ── BEAT 5c · IT ANSWERS ─────────────────────────────────────────────────────
//
// On a DARK band, which is the deliberate break in a page that would otherwise
// alternate grey-white-grey-white down its whole length (DESIGN.md §2.4). It
// also happens to be where the color argument lands hardest: a red February
// against a green March on near-black is legible from across a room, which is
// the entire claim this section is making about the product.
//
// docs/148 §5, binding: "the profit surfaces are a color problem before they
// are a chart problem... a negative month has to read as negative without the
// reader parsing a minus sign. A monochrome P&L is a failed P&L."

/** March, net by day. These twenty-one values sum to exactly $8,090 — the same
 *  figure the breakdown beside them lands on. A chart whose bars do not add up
 *  to the total printed next to them is the kind of detail that costs a page
 *  about money its credibility. */
const MARCH_DAILY = [
  420, 380, -160, 510, 640, 220, -90, 700, 480, 350, -240, 610, 520, 830, 410, -130, 560, 490, 720,
  380, 490,
];

const PEAK = Math.max(...MARCH_DAILY);
const TROUGH = Math.abs(Math.min(...MARCH_DAILY));

export function FinanceProfit() {
  return (
    <Section id="profit" surface="dark" padding="lg">
      <div className="max-w-[820px]">
        <SectionHeader
          accent={M.ink}
          headline={<>Then it just tells you</>}
          lede={
            <>
              One figure, for a period you pick, for one of your businesses or all of them: what
              came in, what the work cost, what the wages cost, what it cost to keep the doors open,
              and what was left. Last period sits beside it, because a number on its own is trivia
              and a number next to the one before it is information.
            </>
          }
        />
      </div>

      <div className="mt-14 grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Card>
          <CardBody className="gap-5">
            <div className="flex items-baseline justify-between gap-4">
              <Heading level={3} size={4}>
                March
              </Heading>
              <Text as="span" className="font-mono">
                one site · 21 days trading
              </Text>
            </div>
            <div className="flex flex-col">
              <MoneyRow label="Sales, after refunds" value="$48,210" />
              <MoneyRow label="Cost of the work" value="−$19,640" kind="work" />
              <MoneyRow label="Wages" value="−$14,300" kind="wages" />
              <MoneyRow label="Running costs" value="−$6,180" kind="running" />
            </div>
            <div className="border-base-300 border-t pt-2">
              <MoneyRow label="Kept" value="$8,090" emphasis tone={netTone(false)} />
              <div className="flex items-baseline justify-between gap-6 pt-1">
                <Text as="span">of every dollar that came in</Text>
                <Text as="span" className={`${netTone(false)} font-medium tabular-nums`}>
                  16.8¢
                </Text>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-6">
          {/* The comparison. February is the section's real argument: same wage
              bill, two-thirds the sales, and the month goes red — which is a
              sentence nobody can write until both halves of the sum are in one
              place. */}
          <Card>
            <CardBody className="gap-4">
              <div className="flex items-baseline justify-between gap-4">
                <Heading level={3} size={4}>
                  February, for comparison
                </Heading>
                <Badge color="error" size="sm" className="tabular-nums">
                  −$1,240
                </Badge>
              </div>
              <Text>
                Sales came in at $31,480 — two-thirds of March. The cost of the work fell with them,
                because it always does. The $14,300 wage bill did not move a dollar, because it
                never does. That is the whole story of the month, and it is invisible in a bank
                balance that was still comfortably positive on the 28th.
              </Text>
              <div className="border-base-300 flex flex-wrap gap-x-8 gap-y-2 border-t pt-4">
                <Text as="span">
                  <span className={`${costTone('wages')} font-medium tabular-nums`}>$14,300</span>{' '}
                  wages, both months
                </Text>
                <Text as="span">
                  <span className="font-medium tabular-nums">−$16,730</span> in sales
                </Text>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="gap-4">
              <Heading level={3} size={4}>
                Net by day, March
              </Heading>
              <DailyBars />
              <Text>
                Each bar is colored by its own sign rather than hanging below a line somebody has to
                find first. Four days in March cost more than they brought in — the 3rd, the 7th,
                the 11th and the 16th — and every one of them is a day you can go and look at.
              </Text>
            </CardBody>
          </Card>
        </div>
      </div>
    </Section>
  );
}

/**
 * The per-day strip. Hand-built rather than a chart library: it is twenty-one
 * static values on a marketing page, and shipping a canvas renderer to draw
 * them would be a page-weight cost with no reader benefit.
 *
 * The bars are sized with inline `height` because each one is a per-instance
 * computed percentage — the same genuinely-dynamic case `<Display>`'s fluid
 * clamp is (see primitives.tsx). Everything else here is a utility class, and
 * both fills are real tokens, so the strip re-resolves in either theme.
 */
function DailyBars() {
  return (
    <div className="flex items-stretch gap-[3px]" aria-hidden>
      {MARCH_DAILY.map((value, i) => {
        const up = value >= 0;
        return (
          <div key={i} className="flex flex-1 flex-col">
            <div className="flex h-[76px] items-end">
              <div
                className={`${up ? 'bg-success' : ''} w-full rounded-t-sm`}
                style={{ height: up ? `${Math.round((value / PEAK) * 100)}%` : '0%' }}
              />
            </div>
            <div className="bg-base-300 h-px w-full" />
            <div className="flex h-[26px] items-start">
              <div
                className={`${up ? '' : 'bg-error'} w-full rounded-b-sm`}
                style={{ height: up ? '0%' : `${Math.round((Math.abs(value) / TROUGH) * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── BEAT 5d · IT RANKS ───────────────────────────────────────────────────────
//
// The climax of the consequence chain and, per docs/148 §5, "the screen that
// justifies the price." Worst margin first, because the losing jobs are the
// actionable end of the list — a ranking that opens on your best work is a
// trophy cabinet, not a tool.
//
// THE `list price` BADGE IS NOT A DISCLAIMER, IT IS THE FEATURE. An order knows
// what it actually collected; a booking only knows what the service is priced
// at, because scheduling stores no collected amount. Blending the two into one
// column would produce a tidier table and a number nobody should act on. See
// `revenueBasis` in wizeworks/packages/finance/src/jobs.ts, and the standing rule that a
// value nobody measured must never render as though somebody had.

interface Job {
  name: string;
  who: string;
  revenue: string;
  /** The booking case — revenue is the service's list price, not a collected
   *  amount, and the row says so. */
  listPrice?: boolean;
  work: string;
  wages: string;
  running: string;
  kept: string;
  rate: string;
  negative: boolean;
}

const JOBS: Job[] = [
  {
    name: 'On-site survey',
    who: 'Kessler Ave Dental · booking',
    revenue: '$180',
    listPrice: true,
    work: '$0',
    wages: '$180',
    running: '$34',
    kept: '−$34',
    rate: '−18.9%',
    negative: true,
  },
  {
    name: 'Vehicle wrap, three vans',
    who: 'Provincial Trades Co · order',
    revenue: '$4,200',
    work: '$2,610',
    wages: '$1,880',
    running: '$450',
    kept: '−$740',
    rate: '−17.6%',
    negative: true,
  },
  {
    name: 'Monument sign and install',
    who: 'Harbourgate Property · order',
    revenue: '$6,800',
    work: '$3,240',
    wages: '$2,320',
    running: '$560',
    kept: '$680',
    rate: '10.0%',
    negative: false,
  },
  {
    name: 'Trade-show banner set',
    who: 'Delaney’s Bakery · order',
    revenue: '$1,950',
    work: '$720',
    wages: '$520',
    running: '$125',
    kept: '$585',
    rate: '30.0%',
    negative: false,
  },
  {
    name: 'Storefront window graphics',
    who: 'Delaney’s Bakery · order',
    revenue: '$2,400',
    work: '$592',
    wages: '$680',
    running: '$120',
    kept: '$1,008',
    rate: '42.0%',
    negative: false,
  },
];

export function FinanceJobs() {
  return (
    <Section id="by-job" padding="lg">
      <div className="max-w-[820px]">
        <SectionHeader
          accent={M.ink}
          headline={<>And then it tells you which work was worth doing</>}
          lede={
            <>
              Every order and every booking, ranked by what you kept on it, worst first — because
              the job that lost money is the one you can do something about. Each row opens into the
              parts, the hours and the share of running costs that got it there, so the answer comes
              with its own working.
            </>
          }
        />
      </div>

      <div className="mt-14 flex flex-col">
        {JOBS.map((job) => (
          <div
            key={job.name}
            className="border-base-300 bg-base-100 grid grid-cols-1 gap-x-8 gap-y-4 border-t px-6 py-6 first:rounded-t-2xl first:border-t-0 last:rounded-b-2xl lg:grid-cols-[1.4fr_1fr_auto] lg:items-center"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                <Heading level={3} size={5}>
                  {job.name}
                </Heading>
                {job.listPrice ? (
                  <Badge color="info" variant="soft" size="sm">
                    list price
                  </Badge>
                ) : null}
              </div>
              <Text className="mt-1">{job.who}</Text>
            </div>

            {/* The working: what came in, and the three kinds it went out as. */}
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Figure label="in" value={job.revenue} />
              <Figure label="work" value={job.work} tone={costTone('work')} />
              <Figure label="wages" value={job.wages} tone={costTone('wages')} />
              <Figure label="running" value={job.running} tone={costTone('running')} />
            </div>

            <div className="flex items-baseline justify-between gap-4 lg:justify-end">
              <span
                className={`${netTone(job.negative)} text-2xl font-medium tabular-nums lg:min-w-[7ch] lg:text-right`}
              >
                {job.kept}
              </span>
              <MarginBadge rate={job.rate} negative={job.negative} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardBody className="gap-3">
            <Heading level={3} size={4}>
              Why the survey says “list price”
            </Heading>
            <Text>
              An order knows exactly what it collected. A booking only knows what that service is
              priced at — a deposit, a discount at the counter or a no-show fee never reached it. So
              a booking’s row is labelled instead of quietly averaged into the same column, and the
              summary counts the two separately. A number nobody measured should never appear as
              though somebody had.
            </Text>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="gap-3">
            <Heading level={3} size={4}>
              One cost, split across the jobs it served
            </Heading>
            <Text>
              A pallet of substrate covers eleven jobs and a month of rent covers all of them. Split
              a cost by percentage or by amount across as many jobs as you like — what is left
              unallocated stays visible as its own figure rather than being quietly spread, so you
              can always see how much of the answer is estimated.
            </Text>
          </CardBody>
        </Card>
      </div>
    </Section>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <span className="flex flex-col">
      <span className={`${tone ?? ''} font-medium tabular-nums`}>{value}</span>
      {/* The field-NAME half of a label/value pair. A small Heading, not a
          caption: it is meant to be read, so it keeps full ink. */}
      <Heading level={6} className="mt-[2px] font-mono">
        {label}
      </Heading>
    </span>
  );
}

// ── BEAT 6 · RESOLUTION — THE HANDOFF ────────────────────────────────────────
//
// Closes the loop the false fix opened. The page conceded in beat 3 that the
// books are right; this is where it says so out loud and hands them back. That
// concession is the product position (docs/148 §1) and it is also the most
// persuasive thing on the page: a platform that tells you what it will not do
// is easier to believe about what it will.
//
// HONESTY CONSTRAINT, load-bearing: today's export is a file. Only the
// spreadsheet provider is `available` in the shipped catalog; QuickBooks Online,
// Xero and FreshBooks are registered as `coming_soon` with the reason on screen.
// So this section says "download" and names direct sync as coming, because "we
// integrate with QuickBooks" usually turns out to mean a CSV with the wrong
// column order — which is the exact failure docs/148 §6 opens by naming.

export function FinanceHandoff() {
  const rules: { title: string; body: string }[] = [
    {
      title: 'Nothing lands in a closed month',
      body: 'You tell sparx the date your books are closed through, and nothing dated before it is ever included. Pushing entries into a month an accountant has already signed off is the fastest way to lose them, so it is prevented rather than discouraged.',
    },
    {
      title: 'Your categories, their account codes',
      body: 'Map each of your categories to the account code your accountant actually uses, once. Every export after that arrives already posted to the right place, so nobody re-codes 140 lines by hand at the end of a quarter.',
    },
    {
      title: '“Mostly worked” is a real answer',
      body: 'The failure that matters is three rows out of a hundred and forty. Each run records what went, what did not, and why — so you get “137 sent, 3 need attention”, with the three named, instead of a green tick that was not quite true.',
    },
  ];
  return (
    <Section id="handoff" padding="lg">
      <div className="max-w-[820px]">
        <SectionHeader
          accent={M.ink}
          headline={<>Your accountant still keeps the books</>}
          lede={
            <>
              sparx does not do bookkeeping, and it is not going to start. There is no general
              ledger here, no chart of accounts, no double entry, no payroll and no tax filing —
              those belong to the software and the person you already trust with them. What sparx
              owes that person is a clean handoff, and that is a feature rather than an
              afterthought.
            </>
          }
        />
      </div>

      <div className="mt-14 grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardBody className="gap-4">
            <Heading level={3} size={4}>
              What you can send today
            </Heading>
            <Text>
              A spreadsheet of your spending for any date range, every column labelled in plain
              words, already posted to your account codes and filtered to one business or all of
              them. Any accounting package will import it, and an accountant who just wants the
              numbers can open it as it is.
            </Text>
            <div className="border-base-300 border-t pt-4">
              <Heading level={3} size={4}>
                What is coming
              </Heading>
              <Text className="mt-2">
                Direct sync to QuickBooks Online, Xero and FreshBooks, and one-click layouts for
                QuickBooks Desktop and Sage 50. Each of them is listed inside sparx today with the
                honest status against it, because “does this work with Xero?” deserves an answer on
                the screen rather than an empty list.
              </Text>
            </div>
            <div className="border-base-300 border-t pt-4">
              <Heading level={3} size={4}>
                And what you can bring in
              </Heading>
              <Text className="mt-2">
                A bank or card statement, on whatever column layout your bank exports. sparx shows
                you exactly what it is about to create before it creates any of it, and remembers
                the layout so the next statement is one click.
              </Text>
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-1">
          {rules.map((rule) => (
            <Card key={rule.title}>
              <CardBody className="gap-3">
                <span className={`${costFill('work')} h-[3px] w-7 rounded-full`} aria-hidden />
                <Heading level={3} size={4}>
                  {rule.title}
                </Heading>
                <Text>{rule.body}</Text>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ── THE SWEEP ────────────────────────────────────────────────────────────────
//
// The things a reader evaluating the module will look for that the narrative
// did not have room for. Neutral cards on purpose: this is a single-module page,
// so a module tint here differentiates nothing and would only compete with the
// one band that is actually painted in Finance green.
export function FinanceCapabilities() {
  const items: { title: string; body: string }[] = [
    {
      title: 'A photo of the receipt, on the cost',
      body: 'Attach the receipt, the supplier invoice, the delivery note — from the same media library the rest of sparx uses. When someone queries a line eight months later, the paper is on the row.',
    },
    {
      title: 'Every business you run, separately',
      body: 'Costs belong to a business, not to a login. Run three under one account and each keeps its own spending, its own profit and its own comparison — with the shared bills that genuinely belong to none of them kept in their own bucket rather than quietly dropped into one.',
    },
    {
      title: 'Who you pay, and how much of it',
      body: 'A list of everyone money goes to with the running total against each, linked through to the supplier or company record when you have those modules on. It is the answer to “how much did we actually spend with them last year” without a spreadsheet.',
    },
    {
      title: 'Stock is not an expense, and we mean it',
      body: 'Buying inventory converts cash into stock; it becomes a cost the day the stock sells. Filing purchase orders as expenses double-counts every part — once when it arrives, again when it goes out — so sparx refuses to, and reads the real figure from your stock instead.',
    },
    {
      title: 'The sparx bill records itself',
      body: 'What you pay us is a running cost like any other, so it appears in your spending automatically and against the right month. A tool that leaves its own price out of your profit figure is flattering you.',
    },
    {
      title: 'It is all on the API too',
      body: 'Every figure on every screen here is available over the API and to an AI assistant through MCP, using your own key. Ask what last quarter cost, or wire the numbers into whatever you already use — the screens are one way in, not the only one.',
    },
  ];
  return (
    <Section padding="lg">
      <SectionHeader headline={<>The rest of it, briefly</>} />
      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Card key={item.title}>
            <CardBody className="gap-3">
              <span className={`${M.bg} h-[3px] w-7 rounded-full`} aria-hidden />
              <Heading level={3} size={4}>
                {item.title}
              </Heading>
              <Text>{item.body}</Text>
            </CardBody>
          </Card>
        ))}
      </div>
    </Section>
  );
}
