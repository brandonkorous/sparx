import type { ReactNode } from 'react';
import { Button } from '@wizeworks/silicaui-react';
import { Display, getModuleColor, Section, Spark } from './primitives';
import { CrmHero } from './crm-sections';
import { CrmOneRecord } from './crm-devices';
import { CrmTimeline } from './crm-timeline';
import { CrmSegments, CrmPipeline } from './crm-segments';
import { CrmAutomation, CrmCapabilities } from './crm-extras';
import { Faq, type FaqItem } from './faq';

/**
 * The /crm marketing page — CRM is the **customer spine** of sparx. The thesis
 * is one customer seen through every lens: because everything runs on one
 * database, a single record carries live signals from every module with nothing
 * to sync. The page moves who → what → group → forecast → automate → proof:
 * the unified record (the marquee device), the no-sync argument, the activity
 * feed, live segments, the pipeline, automation, then the one-database proof.
 * CRM cyan is a *signal* (source dots, stage markers, the spark) — never fill.
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
      <CrmOneRecord />
      <CrmTimeline />
      <CrmSegments />
      <CrmPipeline />
      <CrmAutomation />
      <CrmCapabilities />
      <CrmProof />
      <CrmPricing />
      <Faq
        items={CRM_FAQ}
        id="faq"
        heading={
          <>
            CRM questions
            <Spark color={M.color} />
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
      n: <>1{<Spark color={M.color} />}</>,
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
          One customer, one truth, zero glue
          <Spark color={M.color} />
        </Display>
        <p className="mt-[22px] max-w-[640px] text-lg">
          Because the CRM reads the same database as orders, content, and email, the numbers
          reconcile by default. There&rsquo;s nothing to sync — so there&rsquo;s nothing to drift,
          dedupe, or argue with.
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

// ── PRICING STRIP ───────────────────────────────────────────────────────────────
function CrmPricing() {
  return (
    <Section padding="lg">
      <div
        className={`flex flex-col gap-8 lg:flex-row ${M.bg} bg-soft border-base-300 items-center justify-between rounded-[14px] border p-10`}
      >
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[56px] font-medium tracking-[-0.025em]">$49</span>
            <span className="text-md">/mo</span>
          </div>
          <p className="text-md max-w-[640px]">
            A flat $49/mo — profiles, activity, segments, pipeline, tasks, and automation, with no
            tiers, nothing extra when you hire someone, and nothing extra as your contact list
            grows. It sits alongside your orders and content, so switch it on next to whatever you
            already run. Free for 14 days, and we don&rsquo;t ask for a card to start.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href="/pricing">
            <Button size="lg" variant="outline">
              See all plans →
            </Button>
          </a>
          <Button color="primary" size="lg">
            Activate CRM
          </Button>
        </div>
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
          <Spark color={M.color} />
        </Display>
        <p className="max-w-[640px] text-lg">
          Turn CRM on and your customers arrive with their whole history already attached — orders,
          emails, quotes, conversations. No migration weekend, no contract; switch it off the day
          you stop, and your data stays yours.
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
