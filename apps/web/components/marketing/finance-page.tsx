import type { ReactNode } from 'react';
import { Card, CardBody, Heading, Text } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Display, Section, Spark } from './primitives';
import { costFill, M, netTone } from './finance-money';
import { Faq, type FaqItem } from './faq';
import { PhotoBand } from './photo-band';
import { FinanceBills, FinanceFalseFix, FinanceSpending, FinanceTurn } from './finance-sections';
import { FinanceCapabilities, FinanceHandoff, FinanceJobs, FinanceProfit } from './finance-profit';
import { signupHref } from './cta';

/**
 * The /finance marketing page.
 *
 * THE PAGE TELLS ONE STORY, in the six beats the voice doc specifies
 * (docs/brain/design/voice.md; /crm is the worked example). Read the headlines
 * in order — if they shuffle without loss, it is a feature inventory rather than
 * a story, and this page would have been an easy one to get wrong: Finance is
 * nine surfaces, and nine surfaces is nine headlines nobody has to read in order.
 *
 *   1. PROMISE ......... hero — you know what you sold; this is what you kept
 *   2. RECOGNITION ..... you have a feeling about last month, not a number
 *   3. FALSE FIX ....... so you buy accounting software, and the books are RIGHT
 *                        and still cannot tell you which job paid for itself
 *   4. THE TURN ........ profit is revenue minus spend and we already have the
 *                        revenue half — which is also why it is free if you sell
 *                        here                                          ← LAYER 5
 *   5. CONSEQUENCES .... it records → it chases → it answers → it ranks. The
 *                        chain escalates from typing a number to ranking your
 *                        work, so the order is load-bearing
 *   6. RESOLUTION ...... your accountant still keeps the books (closes beat 3),
 *                        then the receipts, the price, the questions, the ask
 *
 * Beat 4 is the only place in the narrative the one-database argument is made,
 * and it is where the PRICE lives too — "free with Commerce or B2B" is not a
 * promotion, it is the same sentence the turn is already making (docs/148 §2:
 * billing separately for the subtrahend is charging twice for one number). The
 * FAQ answers it again on purpose: a reader who jumped straight there never saw
 * beat 4, and an FAQ is written for exactly that path.
 *
 * Finance green is a signal everywhere except beat 4, which paints it — one
 * identity band per page (DESIGN.md §2.5). Layers present: 1 (the FAQ's bare
 * section), 2, 3, 4 (the pricing band) and 5 (the turn).
 *
 * THE HARD CONSTRAINT ON EVERY WORD HERE is docs/148 §1: sparx does not do
 * bookkeeping and never will. No line on this page may imply a general ledger,
 * a chart of accounts, payroll or tax filing, and nothing claims to replace
 * QuickBooks or Sage 50 — the pricing page's own "replaces" line says an expense
 * tracker, deliberately. Claiming otherwise would be the one sentence that makes
 * a business owner distrust everything else on the page.
 *
 * Facts are grounded in docs/148 and in what actually shipped: the nine
 * workbench surfaces, the two-date model, the stock-is-not-an-expense rule, the
 * per-job ranking with its `revenueBasis` honesty, and an accounting handoff
 * that is a downloadable spreadsheet TODAY with direct sync registered as
 * coming — see the honesty note above FinanceHandoff.
 */
export function FinancePage() {
    return (
        <>
            <FinanceHero />
            {/* BEAT 2 — RECOGNITION. The reader is not careless; they are busy, and
          the thing they are missing is arithmetic nobody has time to do by hand.
          A photograph carries it because the subject is people mid-work, which
          is precisely the moment the cost is being incurred and not recorded. */}
            <PhotoBand
                surface="surface"
                accent={M.ink}
                side="right"
                src="/scenes/craft-bench.jpg"
                alt="Two makers working together at a studio bench, mid-project."
                headline="You have a feeling about last month. You don’t have a number."
                lede="You know it was busy. You know the bank balance went up, or it didn’t. Somewhere in there is the job that took three days longer than you quoted and the supplier who put their prices up in January, and neither of them announced themselves — they just quietly came out of what you kept."
            />
            {/* BEAT 3 — THE FALSE FIX. Concedes that the books are correct, then
          attacks the grain. Conceding first is what makes beat 4 credible. */}
            <FinanceFalseFix />
            {/* BEAT 4 — THE TURN. Layer 5: the module's own hue, painted, at the one
          moment the page says the thing only sparx can say. */}
            <FinanceTurn />
            {/* BEAT 5 — CONSEQUENCES. Four sections that each follow from the turn
          instead of sitting on a menu: it records → it chases → it answers →
          it ranks. Unlike the surface list they came from, the order matters. */}
            <FinanceSpending />
            <FinanceBills />
            <FinanceProfit />
            <FinanceJobs />
            {/* BEAT 6 — RESOLUTION. Closes the loop opened in beat 3: the books were
          right, and they stay with the person who keeps them. Side flipped so
          the two photo bands never stack into the same silhouette. */}
            <PhotoBand
                surface="surface"
                accent={M.ink}
                side="left"
                src="/scenes/workshop-plans.jpg"
                alt="Two people leaning over drawings spread across a workbench, working something out together."
                headline="Then hand your accountant a clean set of numbers"
                lede="The conversation at the end of the quarter stops being a shoebox and a guess. They get every cost for the period, already posted to the account codes they gave you, in a file their software opens — and you get to spend that meeting on decisions instead of on data entry."
            />
            <FinanceHandoff />
            <FinanceCapabilities />
            <FinanceProof />
            <FinancePricing />
            <Faq
                items={FINANCE_FAQ}
                id="faq"
                heading={
                    <>
                        Finance questions
                        <Spark color={M.ink} />
                    </>
                }
                lede="What it does, what it deliberately doesn’t, and what it costs — answered straight. Still deciding? Start the 14-day trial, or turn Commerce on and get this for nothing."
            />
            <FinanceCta />
        </>
    );
}

// ── HERO (BEAT 1 · PROMISE) ──────────────────────────────────────────────────
//
// The device is one month of takings broken into where it all went, as a single
// proportional bar. It earns its place three ways: it is the promise stated as a
// picture, it teaches the three cost hues in the first screenful so every later
// section can drop the words and keep the color, and it is a shape nobody can
// draw from a bank statement — which is the argument the whole page makes.
//
// The four segments are the real proportions of the worked example that runs
// through every section: 40.7 / 29.7 / 12.8 / 16.8, summing to 100.

const SPLIT: { label: string; amount: string; pct: number; fill: string; tone?: string }[] = [
    { label: 'Cost of the work', amount: '$19,640', pct: 40.7, fill: costFill('work') },
    { label: 'Wages', amount: '$14,300', pct: 29.7, fill: costFill('wages') },
    { label: 'Running costs', amount: '$6,180', pct: 12.8, fill: costFill('running') },
    { label: 'Kept', amount: '$8,090', pct: 16.8, fill: 'bg-success', tone: netTone(false) },
];

function FinanceHero() {
    return (
        <Section padding="xl">
            <div className="grid grid-cols-1 items-center gap-[clamp(40px,6vw,72px)] lg:grid-cols-[1.05fr_1fr]">
                <div className="min-w-0">
                    <Display as="h1" size={84} lineHeight={80}>
                        What you spent,{' '}
                        <span>
                            what you kept
                            <Spark color={M.ink} />
                        </span>
                    </Display>
                    <Text variant="lead" className="mt-7 max-w-[600px]">
                        Every cost your business has — parts, wages, rent, fuel, the software nobody remembers
                        signing up for — recorded against what actually came in, so “did we make money” has an
                        answer instead of a shrug. And because sparx already knows what you sold, it can go one
                        better and tell you which jobs made it.
                    </Text>
                    <div className="mt-[34px] flex flex-wrap items-center gap-3">
                        <a
                            href={signupHref('finance-hero')}
                            className={buttonClasses({ color: 'module-finance', size: 'xl' })}
                        >
                            Start free →
                        </a>
                        <a href="#by-job" className={buttonClasses({ size: 'xl', variant: 'outline' })}>
                            See it rank your jobs
                        </a>
                    </div>
                    <Text className="mt-[22px] font-mono">
                        $29/mo · free with Commerce or B2B · 14 days free either way
                    </Text>
                </div>

                <div className="w-full min-w-0">
                    <Card>
                        <CardBody className="gap-5">
                            <div className="flex items-baseline justify-between gap-4">
                                <Heading level={3} size={4}>
                                    Where March went
                                </Heading>
                                <Text as="span" className="font-mono">
                                    $48,210 in
                                </Text>
                            </div>

                            {/* One dollar of takings, to scale. Inline widths are the
                  genuinely-dynamic case: each segment is a per-instance
                  percentage, and there is no utility class for 40.7%. */}
                            <div className="flex h-6 w-full gap-[3px] overflow-hidden rounded-lg" aria-hidden>
                                {SPLIT.map((s) => (
                                    <span key={s.label} className={s.fill} style={{ width: `${s.pct}%` }} />
                                ))}
                            </div>

                            <div className="flex flex-col">
                                {SPLIT.map((s, i) => (
                                    <div
                                        key={s.label}
                                        className={`flex items-baseline justify-between gap-4 py-2.5 ${i === SPLIT.length - 1 ? 'border-base-300 mt-1 border-t pt-4' : ''
                                            }`}
                                    >
                                        <span className="flex min-w-0 items-center gap-2.5">
                                            <span className={`${s.fill} h-2.5 w-2.5 shrink-0 rounded-full`} aria-hidden />
                                            <Text
                                                as="span"
                                                className={i === SPLIT.length - 1 ? 'font-medium' : undefined}
                                            >
                                                {s.label}
                                            </Text>
                                        </span>
                                        <span className="flex shrink-0 items-baseline gap-3">
                                            <Text as="span" className="font-mono tabular-nums">
                                                {s.pct}%
                                            </Text>
                                            <span
                                                className={`${s.tone ?? ''} min-w-[8ch] text-right font-medium tabular-nums`}
                                            >
                                                {s.amount}
                                            </span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </CardBody>
                    </Card>
                </div>
            </div>
        </Section>
    );
}

// ── DARK PROOF ───────────────────────────────────────────────────────────────
function FinanceProof() {
    const stats: { n: ReactNode; l: string }[] = [
        {
            n: <>1{<Spark color={M.ink} />}</>,
            l: 'place your sales and your costs both live — profit is read, never reconciled',
        },
        {
            n: '0',
            l: 'figures you enter twice · what a part cost is already recorded, at what you paid',
        },
        { n: '2', l: 'dates on every cost — the month it belongs to, and the day the money left' },
        { n: '$0', l: 'what this costs if you already sell through sparx with Commerce or B2B' },
    ];
    return (
        <Section surface="dark" padding="lg">
            <div className="max-w-[760px]">
                <Display size={46} lineHeight={48}>
                    What that adds up to
                    <Spark color={M.ink} />
                </Display>
                <Text variant="lead" className="mt-6 max-w-[640px]">
                    No per-user charge, nothing metered by how many costs you record, and no separate bill for
                    the half of the sum you already bought. Four numbers worth knowing before you look at the
                    one that matters.
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
// foreground, and the copy is short because it has to be — which suits a closing
// ask anyway. Same constraint and same reasoning as /crm's pricing band.
//
// The control is SOLID `neutral`: a painted band is a fill, not a theme scope,
// so an outline or ghost button would ink itself from the light theme.
function FinancePricing() {
    return (
        <Section surface="primary" padding="lg">
            <div className="flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-center">
                <div className="flex flex-1 flex-col gap-4">
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                        <span className="text-[clamp(56px,7vw,80px)] leading-none font-medium tracking-[-0.03em]">
                            $29
                        </span>
                        <span className="text-2xl">/mo — or nothing at all</span>
                    </div>
                    <p className="max-w-[660px] text-2xl leading-[1.4]">
                        Flat, whoever you are. And if you sell through sparx with Commerce or B2B, Finance is
                        included at no extra charge — you already paid for the half of this sum we subtract
                        from. Free for fourteen days regardless, and we don’t ask for a card.
                    </p>
                </div>
                <a
                    href={signupHref('finance-pricing')}
                    className={buttonClasses({ color: 'neutral', size: 'xl' })}
                >
                    Switch Finance on →
                </a>
            </div>
        </Section>
    );
}

// ── FINAL CTA (dark) ─────────────────────────────────────────────────────────
function FinanceCta() {
    return (
        <Section surface="dark" padding="xl">
            <div className="flex flex-col items-start gap-9">
                <Display size={88} lineHeight={84}>
                    Find out what you actually kept
                    <Spark color={M.ink} />
                </Display>
                <Text variant="lead" className="m-0 max-w-[660px]">
                    Fourteen days free, no card, and no contract at the end of it. Turn it off the day it
                    stops earning its $29 and every cost, receipt and figure you recorded stays yours —
                    exportable in full, from a button, without asking anyone.
                </Text>
                <div className="flex flex-wrap items-center gap-3">
                    <a
                        href={signupHref('finance-final')}
                        className={buttonClasses({ color: 'module-finance', size: 'xl' })}
                    >
                        Start free →
                    </a>
                    <a href="#the-turn" className={buttonClasses({ size: 'xl', variant: 'outline' })}>
                        Why it’s free with Commerce
                    </a>
                </div>
            </div>
        </Section>
    );
}

// Page-specific FAQ — real evaluation questions, answered straight and grounded
// in docs/148. Feeds the FAQPage JSON-LD via <Faq>, so accuracy is load-bearing:
// an assistant quotes these verbatim, which makes the bookkeeping boundary and
// the shipped-vs-coming state of the accounting sync the two answers that must
// not drift.
const FINANCE_FAQ: FaqItem[] = [
    {
        id: 'finance-not-accounting',
        question: 'Is this accounting software? Does it replace QuickBooks?',
        answer:
            'No, and it is not going to. There is no general ledger here, no chart of accounts, no double entry, no bank reconciliation, no payroll and no tax filing — that is your accounting package’s job and your accountant’s, and both are better at it than a new platform would be. sparx answers the operational question instead: what did this month cost, and which work was worth doing. Then it hands your accountant a clean, mapped file for the statutory one.',
    },
    {
        id: 'finance-price',
        question: 'How much does Finance cost?',
        answer:
            'A flat $29 a month on its own — no per-user charge and nothing metered by how many costs you record. If you sell through sparx with Commerce or B2B, it is included at no extra cost, the same way Invoicing and Inventory are. The reason is not a promotion: profit is what came in minus what went out, you already bought the revenue half, and billing you separately for the part we subtract from it would be charging twice for one number.',
    },
    {
        id: 'finance-standalone',
        question: 'Can I use it if I don’t sell anything through sparx?',
        answer:
            'Yes — it needs no other module to be useful. A consultancy, a nonprofit, a publisher, a landlord: anyone with costs can record them, group them their own way, track what they owe and see what it all came to, with no store and no site. That is the case the $29 standalone price is for. Add Commerce or B2B later and the charge simply stops.',
    },
    {
        id: 'finance-typing',
        question: 'Do I have to type in every single cost?',
        answer:
            'Far less than you would expect. What you sold, what each part cost coming off the shelf, and what a marketplace or card processor took are already recorded by the rest of sparx, so none of that is re-entered. What you pay sparx records itself. Anything that repeats — rent, insurance, subscriptions, a vehicle lease — is set up once and then posts itself every month. You can also import a bank or card statement on whatever column layout your bank exports, with a preview of exactly what will be created before anything is. What is left is genuinely small, and the entry row takes about four seconds.',
    },
    {
        id: 'finance-accountant',
        question: 'Will it work with my accountant, or with QuickBooks and Sage?',
        answer:
            'Today you download a spreadsheet of any date range with every column labelled, already posted to the account codes you mapped once, filtered to one of your businesses or all of them. Any accounting package imports that, and an accountant who just wants the numbers can open it as it is. Direct sync to QuickBooks Online, Xero and FreshBooks and one-click layouts for QuickBooks Desktop and Sage 50 are on the way — each is listed inside sparx today with its honest status, rather than being implied and then absent. Nothing is ever sent dated before the day you tell us your books are closed through.',
    },
    {
        id: 'finance-inventory',
        question: 'Are the parts and stock I buy counted as expenses?',
        answer:
            'Not when you buy them, and that is deliberate. Buying stock converts cash into stock — it becomes a cost on the day that stock sells, which sparx already records at what you actually paid for it. Filing purchase orders as expenses would count every part twice, once on arrival and again on sale, and quietly make a profitable month look terrible. So the cost of the work in your profit figure is read from your real stock movements rather than from your purchase orders.',
    },
];
