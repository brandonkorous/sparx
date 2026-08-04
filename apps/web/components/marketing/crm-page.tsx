import type { ReactNode } from 'react';
import { Button } from '@wizeworks/silicaui-react';
import { Display, getModuleColor, Section, Spark } from './primitives';
import { CrmHero } from './crm-sections';
import { CrmOneRecord, CrmTurn } from './crm-devices';
import { CrmTimeline } from './crm-timeline';
import { CrmSegments, CrmPipeline } from './crm-segments';
import { CrmAutomation, CrmCapabilities } from './crm-extras';
import { Faq, type FaqItem } from './faq';
import { PhotoBand } from './photo-band';

/**
 * The /crm marketing page.
 *
 * THE PAGE TELLS ONE STORY. It used to be a feature inventory: nine sections
 * that each named a capability and then explained it — record, timeline,
 * segments, pipeline, automation, "everything a sales team needs". Read only the
 * headlines and they shuffled into any order without losing anything, which is
 * the diagnostic (docs/brain/design/voice.md, "A page tells one story"). It also
 * argued to the wrong reader: the comparison section addressed someone who had
 * already decided they wanted a CRM and was choosing a vendor, when the actual
 * reader doesn't know they want a CRM — they know a regular walked in and the
 * new hire treated them like a stranger.
 *
 * The six beats, in an order that cannot be rearranged:
 *
 *   1. PROMISE ......... hero — your business already knows this customer
 *   2. RECOGNITION ..... you already do this; it just doesn't scale past you
 *   3. FALSE FIX ....... so you buy a CRM, and now they exist in five places
 *   4. THE TURN ........ nothing to import — it's already your data   ← LAYER 5
 *   5. CONSEQUENCES .... writes itself → keeps answering → already knows →
 *                        does the next thing (records, groups, connects, acts —
 *                        escalating, so the order is load-bearing)
 *   6. RESOLUTION ...... now the new hire knows them too (closes beat 2), then
 *                        the receipts, the price, the questions, the ask
 *
 * Beat 4 is the only place in the NARRATIVE that the one-database argument is
 * made. It ran four times before — hero lede, comparison lede, a dedicated stats
 * band, and the FAQ — which is what a page does when it has no turn to build
 * toward. The FAQ still answers it, deliberately: a reader who jumped straight
 * there never saw beat 4, and an FAQ is written for exactly that path.
 *
 * CRM cyan is a *signal* (source dots, stage markers, the spark) everywhere
 * except beat 4, which paints it: the module's own hue at the one moment the
 * page makes the argument only that module can make. DESIGN.md §2.5.
 *
 * Bespoke + full-length, modeled on commerce-page.tsx / cms-page.tsx; the
 * markup-heavy device sections live in crm-sections / crm-devices / crm-timeline
 * / crm-segments / crm-extras so each file stays cohesive.
 *
 * Facts are grounded in docs/11 (CRM PRD) + docs/17 (billing) + the real
 * dashboard CRM surfaces. The record stats (total spent, orders, AOV), the
 * activity vocabulary, the segment rule fields, and the pipeline stages mirror
 * what ships. Flat $49/mo, no tiers, 14-day trial.
 *
 * This page used to claim that adding CRM stepped the Commerce transaction fee
 * to 0.3% (citing docs/17 §2) and sold CRM partly on that basis. It does not.
 * That tiered-fee model was removed on 2026-07-22 and never shipped — the fee
 * rule is docs/94 §8 (sparx Pay 0.5%, every other gateway $0) and nothing about
 * it varies with which modules you run. Corrected 2026-08-02.
 */
export function CrmPage() {
  return (
    <>
      <CrmHero />
      {/* BEAT 2 — RECOGNITION. The reader is not failing at this; they are good
          at it and have hit a ceiling. Naming the ceiling is what earns the
          right to argue architecture two beats later, so this sits BEFORE the
          comparison, not after it.

          A photograph carries it because a visitor scanning the page reads the
          pictures long before the copy — and because the thing being described
          is a person in front of another person, which prose renders worse. */}
      <PhotoBand
        accent={M.ink}
        side="right"
        src="/scenes/salon-consult.jpg"
        alt="A stylist leaning in to talk with a client in her chair, mid-consultation in a small salon."
        headline="You already do this. It just doesn’t scale past you."
        lede="You know who’s particular about delivery dates, who orders the same thing every time, and whose last order turned up damaged. None of it is written down anywhere — it’s in your head, and that works right up until you’re not the one standing there."
      />
      {/* BEAT 3 — THE FALSE FIX. */}
      <CrmOneRecord />
      {/* BEAT 4 — THE TURN, and the only place the one-database argument is
          made. Layer 5: the module's own hue, painted, at the one moment the
          page says the thing only sparx can say. */}
      <CrmTurn />
      {/* BEAT 5 — CONSEQUENCES. These four are the old feature tour, re-ordered
          and re-headlined so each one follows from the turn instead of sitting
          on a menu: it records → it groups → it connects → it acts. The chain
          escalates, so unlike the list it replaced, the order is load-bearing. */}
      <CrmTimeline />
      <CrmSegments />
      <CrmPipeline />
      <CrmAutomation />
      {/* BEAT 6 — RESOLUTION. Closes the loop opened in beat 2: the thing that
          didn't scale past you now does. Moved here from between segments and
          pipeline, where it was breaking up a run of device sections — a
          pacing job, not a story job. Side flipped so the two photo bands never
          stack into the same silhouette. */}
      <PhotoBand
        surface="surface"
        accent={M.ink}
        side="left"
        src="/scenes/counter-handover.jpg"
        alt="A café worker smiling as he hands a paper bag across the counter to a regular customer."
        headline="Now the new hire knows them too"
        lede="The customer who comes back every week is worth more than the one you paid to find, and they can tell whether they’re remembered. Everyone on your team sees the same history — so a regular gets treated like a regular, whoever happens to be working that day."
      />
      <CrmCapabilities />
      <CrmProof />
      <CrmPricing />
      <Faq
        items={CRM_FAQ}
        id="faq"
        heading={
          <>
            CRM questions
            <Spark color={M.ink} />
          </>
        }
        lede="How it connects, what it costs, and what it does for a team — answered straight. Still deciding? Read the CRM docs or start the 14-day trial."
      />
      <CrmCta />
    </>
  );
}

const M = getModuleColor('crm');

// Page-specific FAQ. Real evaluation questions for sparx CRM, answered straight
// and grounded in docs/11 (PRD) + docs/17 (billing) — no tier/plan language.
// Feeds the FAQPage JSON-LD via <Faq>, so accuracy is load-bearing.
const CRM_FAQ: FaqItem[] = [
  {
    id: 'crm-vs-bolton',
    question: 'How is this different from a bolt-on CRM?',
    answer:
      'A bolt-on CRM keeps its own copy of your customer and trades webhooks with your store to stay roughly in sync. sparx CRM has no copy: it reads the same database as orders, email, and quotes, so the customer record is always current and never disagrees with itself. There is nothing to integrate, sync, or dedupe between systems.',
  },
  {
    id: 'crm-pricing',
    question: 'How much does sparx CRM cost?',
    answer:
      'A flat $49/mo. No tiers, no per-seat charge, and no per-contact metering — your customers, activities, and deals are unlimited. Add any other modules à la carte and it all lands on one bill. Start on a 14-day free trial; no card required to begin.',
  },
  {
    id: 'crm-needs-commerce',
    question: 'Do I need Commerce to use CRM?',
    answer:
      'No. CRM runs on its own — a sales team or a service business can manage contacts, activity, segments, and a pipeline with no store at all. If you do run Commerce, the two share one customer record, so what someone bought and every conversation you have had with them sit on the same page.',
  },
  {
    id: 'crm-segments',
    question: 'How do segments work?',
    answer:
      'You build a segment from rules on any field of the record — lifetime spend, order count, days since last order, tags, email engagement, or B2B pricing tier and credit status. The segment recomputes itself as customers cross the line, and it syncs straight to an Email broadcast, so there is never a list to export.',
  },
  {
    id: 'crm-import',
    question: 'Can I import my existing contacts and deals?',
    answer:
      'Yes. Import contacts, companies, and deals by CSV, with duplicate detection on email and a guided merge that keeps both activity feeds. Because everything is also available over the API and MCP, you can script a migration from your old CRM and write straight into sparx.',
  },
  {
    id: 'crm-sales-team',
    question: 'Is it built for a sales team?',
    answer:
      'Yes. Assign reps and deal owners, set tasks with due dates and priorities, and work deals on a kanban board, a sortable list, or a probability-weighted forecast. Reports cover win/loss by rep, deal cycle length, and pipeline value by stage — all off live data, with no per-seat fee.',
  },
];

// ── DARK PROOF ────────────────────────────────────────────────────────────────
function CrmProof() {
  const stats: { n: ReactNode; l: string }[] = [
    {
      n: <>1{<Spark color={M.ink} />}</>,
      l: 'database under customers, orders, and email — nothing to sync',
    },
    { n: '0', l: 'webhooks to babysit · no Zapier between you and your data' },
    // Replaces a "0.3% Commerce transaction fee once CRM is on — it pays for
    // itself" stat, which was false: no fee anywhere on the platform changes
    // because you turned CRM on. The replacement is the real pricing claim,
    // stated elsewhere on this page and in the module catalog — and it is not a
    // second "1", which is what a "one record per customer" line would have made
    // this row, next to the "1 database" stat it opens with.
    { n: '∞', l: 'contacts, activities and deals — nothing metered, no charge per seat' },
    { n: '$0', l: 'to export — full JSON or SQL from the dashboard, no ticket' },
  ];
  return (
    <Section surface="dark" padding="lg">
      <div className="max-w-[760px]">
        <Display size={46} lineHeight={48}>
          What that adds up to
          <Spark color={M.ink} />
        </Display>
        {/* This band used to re-argue the one-database point under the headline
            "One customer, one truth, zero glue" — the FOURTH time the page made
            it, after the hero, the comparison lede and the turn. A story makes
            its point once, at the moment it turns; everything after is
            consequence. So this is now the RECEIPTS for beat 4, not a restatement
            of it, and the copy points forward to the price rather than back at
            the architecture. ("Zero glue" was also jargon — the audience is
            non-technical business owners.) */}
        <p className="mt-[22px] max-w-[640px] text-lg">
          No per-seat pricing, no per-contact metering, and no charge for the parts that make it
          work. Four numbers worth knowing before you look at the one that matters.
        </p>
      </div>
      <div className="mt-14 grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.l} className={i === 0 ? '' : 'border-base-300 border-l pl-8'}>
            <div className="text-[clamp(36px,5vw,54px)] leading-none font-medium tracking-[-0.03em]">
              {s.n}
            </div>
            <div className="mt-3 text-sm">{s.l}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── PRICING STRIP (LAYER 4) ───────────────────────────────────────────────────
//
// A PAINTED band — the ask, in the brand's own color, which is the page's layer
// 4 (DESIGN.md §2.5: at least one section of each of layers 1–4 on every page,
// plus a layer 5 on a module page).
//
// It was a `${M.bg} bg-soft` box on an unpainted section: cyan at ~5% inside a
// border, which is a RULE #3 violation twice over — soft used as a default
// rather than as the accent on the one thing that earns it, and the module hue
// spent on a wash where it can't be read. Removing it also stops this band
// competing with the layer-5 turn, which is where the cyan actually argues
// something.
//
// The band paints; it is NOT a theme scope. So the control is SOLID: near-black
// `neutral` on Ember is the strong contrasting pair (the same one /platform's
// pricing band uses). An `outline`/`ghost` button here would ink itself from the
// LIGHT theme and land near-black on Ember. band.tsx, DESIGN.md §3.0.
//
// EMBER IS A DISPLAY GROUND, NOT A READING GROUND — the one hard constraint on
// this band, and the first draft broke it. Measured in the browser, every
// painted tone carries body text except this one: neutral 13.64:1, accent
// 10.16:1, secondary 18.05:1 — and `primary` 4.13:1, which clears WCAG's
// large-text bar (3.0) but fails the body bar (4.5). Large means 24px regular,
// so an 18px lede and a 16px link on Ember both fail, which is exactly what the
// first version of this band shipped.
//
// Hence: nothing here is smaller than `text-2xl` (24px) unless it is a solid
// control painting its own foreground. The copy is short because it has to be —
// which suits a closing ask anyway. A "See all plans" link used to sit beside
// the button; it is gone rather than enlarged. At the moment of commitment a
// second, quieter action is a distraction, and the FAQ directly below already
// offers the other paths.
function CrmPricing() {
  return (
    <Section surface="primary" padding="lg">
      <div className="flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-center">
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex items-baseline gap-2">
            <span className="text-[clamp(56px,7vw,80px)] leading-none font-medium tracking-[-0.03em]">
              $49
            </span>
            <span className="text-2xl">/mo</span>
          </div>
          <p className="max-w-[620px] text-2xl leading-[1.4]">
            Everything on this page, flat. Nothing extra when you hire someone, nothing extra as
            your list grows, and no tiers to compare. Free for fourteen days — we don&rsquo;t ask
            for a card.
          </p>
        </div>
        <Button color="neutral" size="xl">
          Activate CRM →
        </Button>
      </div>
    </Section>
  );
}

// ── FINAL CTA (dark) ──────────────────────────────────────────────────────────
function CrmCta() {
  return (
    <Section surface="dark" padding="xl">
      <div className="flex flex-col items-start gap-9">
        <Display size={88} lineHeight={84}>
          Know every customer cold
          <Spark color={M.ink} />
        </Display>
        {/* The ask. It does NOT re-explain the turn — beat 4 owns that, and the
            phrase "no migration weekend" now lives there. What belongs here is
            what it costs the reader to try, and what happens if they stop. */}
        <p className="max-w-[640px] text-lg">
          Fourteen days free, no card, and no contract at the end of it. Turn it off the day it
          stops being worth $49 and your customers, their history and every note stay yours —
          exportable in full, from a button, without asking anyone.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button color="module-crm" size="xl">
            Activate CRM →
          </Button>
          <a href="#record">
            <Button size="xl" variant="outline">
              See a customer record
            </Button>
          </a>
        </div>
      </div>
    </Section>
  );
}
