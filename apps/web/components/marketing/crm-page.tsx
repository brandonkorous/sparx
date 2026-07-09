import type { ReactNode } from 'react';
import { Button } from '@wizeworks/silicaui-react';
import { Container, Display, getModuleColor, moduleTint, Section, Spark } from './primitives';
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
 * what ships. Flat $49/mo, no tiers, 14-day trial; adding CRM steps the Commerce
 * transaction fee to 0.3% (docs/17 §2).
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
        accent={M.color}
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
const SANS = 'var(--font-sans)';

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
      'No. CRM runs on its own — a sales team or a service business can manage contacts, activity, segments, and a pipeline with no store at all. If you do run Commerce, the two share one customer record, and adding CRM steps your Commerce per-transaction fee down from 0.5% to 0.3%.',
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
    { n: '0.3%', l: 'Commerce transaction fee once CRM is on — it pays for itself' },
    { n: '$0', l: 'to export — full JSON or SQL from the dashboard, no ticket' },
  ];
  return (
    <Section surface="dark" padding="lg">
      <div style={{ maxWidth: '760px' }}>
        <Display size={46} lineHeight={48} color="#FFFFFF">
          One customer, one truth, zero glue
          <Spark color={M.color} />
        </Display>
        <p
          style={{
            fontFamily: SANS,
            fontSize: '18px',
            lineHeight: '30px',
            color: '#A1A1AA',
            maxWidth: '640px',
            margin: '22px 0 0',
          }}
        >
          Because the CRM reads the same database as orders, content, and email, the numbers
          reconcile by default. There&rsquo;s nothing to sync — so there&rsquo;s nothing to drift,
          dedupe, or argue with.
        </p>
      </div>
      <div className="mkt-grid-4-2-1" style={{ marginTop: '56px', gap: 0 }}>
        {stats.map((s, i) => (
          <div
            key={s.l}
            style={{
              padding: i === 0 ? '0' : '0 0 0 32px',
              borderLeft: i === 0 ? 'none' : '1px solid #262626',
            }}
          >
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: 'clamp(36px, 5vw, 54px)',
                letterSpacing: '-0.03em',
                color: '#FFFFFF',
                lineHeight: 1,
              }}
            >
              {s.n}
            </div>
            <div
              style={{
                marginTop: '12px',
                fontFamily: SANS,
                fontSize: '14.5px',
                lineHeight: '22px',
                color: '#A1A1AA',
              }}
            >
              {s.l}
            </div>
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
        className="mkt-stack-on-tablet"
        style={{
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '40px',
          backgroundColor: moduleTint(M.color),
          border: '1px solid var(--color-base-300)',
          borderRadius: '14px',
          gap: '32px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '56px',
                letterSpacing: '-0.025em',
                color: 'var(--color-base-content)',
              }}
            >
              $49
            </span>
            <span
              style={{
                fontFamily: SANS,
                fontSize: '16px',
                color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              }}
            >
              /mo
            </span>
          </div>
          <p
            style={{
              fontFamily: SANS,
              fontSize: '14px',
              lineHeight: '22px',
              color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              margin: 0,
              maxWidth: '640px',
            }}
          >
            A flat $49/mo — profiles, activity, segments, pipeline, tasks, and automation, with no
            tiers, no per-seat charge, and no per-contact metering. It sits on the same database as
            your orders and content, so switch it on alongside whatever you already run. Adding CRM
            also steps your Commerce transaction fee down to 0.3%. Start free for 14 days; no card
            to begin.
          </p>
        </div>
        <div className="mkt-cluster" style={{ gap: '12px' }}>
          <a href="/pricing">
            <Button size="lg" variant="outline">
              See all plans →
            </Button>
          </a>
          <Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>
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
    <section
      style={{
        paddingTop: 'var(--section-py-xl)',
        paddingBottom: 'var(--section-py-xl)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: '#0A0A0A',
      }}
    >
      <Container
        style={{ display: 'flex', flexDirection: 'column', gap: '36px', alignItems: 'flex-start' }}
      >
        <Display size={88} lineHeight={84} color="#FFFFFF">
          Know every customer cold
          <Spark color={M.color} />
        </Display>
        <p
          style={{
            fontFamily: SANS,
            fontSize: '18px',
            lineHeight: '30px',
            color: '#A1A1AA',
            maxWidth: '640px',
            margin: 0,
          }}
        >
          Turn CRM on and your customers arrive with their whole history already attached — orders,
          emails, quotes, conversations. No migration weekend, no contract; switch it off the day
          you stop, and your data stays yours.
        </p>
        <div className="mkt-cluster" style={{ gap: '12px' }}>
          <Button size="xl" style={{ backgroundColor: M.color }}>
            Activate CRM →
          </Button>
          <a href="#record">
            <Button
              size="xl"
              variant="outline"
              style={{ backgroundColor: 'transparent', borderColor: '#2A2A2A', color: '#FFFFFF' }}
            >
              See a customer record
            </Button>
          </a>
        </div>
      </Container>
    </section>
  );
}
