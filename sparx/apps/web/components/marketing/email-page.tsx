import type { ReactNode } from 'react';
import { Button, Text } from '@wizeworks/silicaui-react';
import { Display, getModuleColor, Section, Spark } from './primitives';
import { EmailHero, EmailPipeline } from './email-sections';
import { EmailKinds, EmailDeliverability } from './email-deliverability';
import { EmailBroadcast, EmailAutomations, EmailCapabilities } from './email-devices';
import { Faq, type FaqItem } from './faq';

/**
 * The /email marketing page — Email is the platform's **voice**: every message
 * the business sends, on its OWN domain, triggered by its OWN data. The thesis
 * traces one email through the system — a platform event fires, sparx renders it
 * from React Email atomic components, and it lands in the inbox: authenticated,
 * on-brand, on the tenant's own domain. The page moves preview → pipeline →
 * the two kinds → deliverability → broadcast → automations → capabilities →
 * one-database proof. Email sky is a deliverability *signal* (verified ticks,
 * the open/click pulse, the spark) — never flood fill.
 *
 * Bespoke + full-length, modeled on commerce-page / cms-page / crm-page; the
 * markup-heavy device sections live in email-sections / email-deliverability /
 * email-devices so each file stays cohesive.
 *
 * Facts are grounded in docs/13 (Email PRD v3.2) + docs/17 (billing) + the real
 * dashboard email surfaces. Outbound is event-driven (`email.send` → Pub/Sub →
 * email-worker → @wizeworks/email React Email render → provider; Mailgun in prod,
 * console in dev — Postal is decommissioned), sent from the tenant's own domain
 * after DKIM/SPF/DMARC verify, with engagement fed back to the CRM. Flat
 * $29/mo, no tiers, no per-email or per-contact fees, 14-day trial.
 */
export function EmailPage() {
  return (
    <>
      <EmailHero />
      <EmailPipeline />
      <EmailKinds />
      <EmailDeliverability />
      <EmailBroadcast />
      <EmailAutomations />
      <EmailCapabilities />
      <EmailProof />
      <EmailPricing />
      <Faq
        items={EMAIL_FAQ}
        id="faq"
        heading={
          <>
            Email questions
            <Spark color={E.color} />
          </>
        }
        lede="Deliverability, your own domain, what it costs, and how it fits — answered straight. Still deciding? Read the email docs or start the 14-day trial."
      />
      <EmailCta />
    </>
  );
}

const E = getModuleColor('email');

// Page-specific FAQ. Real evaluation questions for sparx Email, answered
// straight and grounded in docs/13 (PRD v3.2) + docs/17 (billing) — no tier/
// plan language. Feeds the FAQPage JSON-LD via <Faq>, so accuracy is
// load-bearing (an assistant quotes these verbatim).
const EMAIL_FAQ: FaqItem[] = [
  {
    id: 'email-deliverability',
    question: 'Will my email actually reach the inbox?',
    answer:
      'Deliverability is the whole point. The moment your domain verifies, sparx authenticates it with SPF, DKIM, and DMARC and signs every message with your DKIM key. Bounce rate is watched against a 2% threshold and spam complaints against 0.1% per domain, with hard bounces and complaints suppressed automatically — the practices that keep a sender out of the spam folder.',
  },
  {
    id: 'email-own-domain',
    question: 'Do I send from my own domain?',
    answer:
      'Yes. Add your domain, drop in the DNS records sparx generates for you, and once they verify your mail sends from your own address — orders@yourbrand.com, not a shared blast domain. Until a domain is verified, email sends from the shared sparx domain so you are never blocked while DNS propagates.',
  },
  {
    id: 'email-types',
    question: 'What is the difference between transactional and marketing email?',
    answer:
      'Transactional emails are triggered by platform events — an order confirmation, a shipping update, a password reset, a quote reply — and go out the instant the event fires. Marketing broadcasts are ones you choose to send to a CRM segment. Both run on the same engine, the same domain, and the same reputation, with one set of analytics.',
  },
  {
    id: 'email-pricing',
    question: 'How much does sparx Email cost?',
    answer:
      'A flat $29/mo. No per-email fees and no contact-tier surcharges — send 10,000 or 1,000,000 emails a month for the same price. Add any other modules à la carte and it all lands on one bill. Start on a 14-day free trial; no card required to begin.',
  },
  {
    id: 'email-crm',
    question: 'Do my email events feed the rest of sparx?',
    answer:
      'Yes. Opens, clicks, bounces, and unsubscribes write straight onto the customer record in the CRM, so a segment like “opened the last email but did not buy” is always current — there is no list to export and nothing to sync. Your AI assistant can read the same stats over MCP.',
  },
  {
    id: 'email-templates',
    question: 'Can I use my own templates and branding?',
    answer:
      'Every email is composed from on-brand, mobile-ready components and carries your logo, colors, and sender name. Edit templates with a variable picker and live preview, check the spam score, and send a test to yourself before anything goes to a customer.',
  },
];

// ── DARK PROOF ──────────────────────────────────────────────────────────────
function EmailProof() {
  const stats: { n: ReactNode; l: string }[] = [
    {
      n: <>1{<Spark color={E.color} />}</>,
      l: 'database under email, customers, and orders — nothing to sync',
    },
    { n: '$0', l: 'per email — flat monthly, send 10K or 1M for the same price' },
    { n: '3', l: 'records auto-configured — SPF, DKIM, DMARC, then monitored' },
    { n: '<2%', l: 'bounce-rate guardrail watched per domain, complaints under 0.1%' },
  ];
  return (
    <Section surface="dark" padding="lg">
      <div className="max-w-[760px]">
        <Display size={46} lineHeight={48}>
          Your domain, your list, your data
          <Spark color={E.color} />
        </Display>
        <Text variant="lead" className="mt-6 max-w-[640px]">
          Email runs on the same database as your customers and orders, so every open feeds the CRM
          and every segment is current. Send from your own domain, keep your own reputation, and pay
          one flat price no matter the volume.
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

// ── PRICING STRIP ───────────────────────────────────────────────────────────
function EmailPricing() {
  return (
    <Section padding="lg">
      <div
        className={`flex flex-col lg:flex-row ${E.bg} bg-soft border-base-300 items-center justify-between gap-8 rounded-[14px] border p-10`}
      >
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="font-sans text-[56px] font-medium tracking-[-0.025em]">$29</span>
            <Text as="span" className="text-md">
              /mo
            </Text>
          </div>
          <Text className="m-0 max-w-[640px] text-sm">
            A flat $29/mo — transactional and marketing email, automations, templates, and
            broadcasts. No per-email fees and no contact-tier surcharges; send 10K or 1M a month for
            the same price. Switch it on alongside whatever modules you run. Start free for 14 days;
            no card to begin.
          </Text>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href="/pricing">
            <Button size="lg" variant="outline">
              See all plans →
            </Button>
          </a>
          <Button color="primary" size="lg">
            Activate Email
          </Button>
        </div>
      </div>
    </Section>
  );
}

// ── FINAL CTA (dark) ────────────────────────────────────────────────────────
function EmailCta() {
  return (
    <Section surface="dark" padding="xl">
      <div className="flex flex-col items-start gap-9">
        <Display size={88} lineHeight={84}>
          Send your first email today
          <Spark color={E.color} />
        </Display>
        <Text variant="lead" className="m-0 max-w-[640px]">
          Turn Email on, add your domain, and transactional mail starts flowing immediately — the
          marketing tools are there when you want them. No migration weekend, no contract; turn it
          off the day you stop, and your data stays yours.
        </Text>
        <div className="flex flex-wrap items-center gap-3">
          <Button color="module-email" size="xl">
            Activate Email →
          </Button>
          <a href="#pipeline">
            <Button size="xl" variant="outline">
              See how a send flows
            </Button>
          </a>
        </div>
      </div>
    </Section>
  );
}
