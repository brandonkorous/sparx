import type { ReactNode } from 'react';
import { Section, SectionHeader, Spark } from './primitives';
import { FaqSpread } from './faq-spread';

// The marketing FAQ — authored here as the source of truth. These are page
// content, not CMS "content items": the old `faq_item` content type was
// reclassified into a builder FAQ component (docs/51 §7).
export interface FaqItem {
  id: string;
  order?: number;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'static-1',
    order: 10,
    question: 'Can I really get a live site in five minutes?',
    answer:
      'Yes — that’s the design target the entire platform is built around. Sign up, pick a theme, activate the modules you need, add a product, take an order. We measure new-tenant time-to-first-order and that number is the north star metric. If it takes longer for you, something is broken and we want to know.',
  },
  {
    id: 'static-2',
    order: 20,
    question: 'What happens if I turn a module off?',
    answer:
      'Billing stops on the next cycle. Your data stays exactly where it was. The module’s UI becomes inactive — but if you turn it back on a year later, every order, customer, and configuration is still there. We never charge for storage on inactive modules and we never delete your data without your explicit request.',
  },
  {
    id: 'static-3',
    order: 30,
    question: 'How does the MCP integration actually work?',
    answer:
      'You enable the AI module, copy your MCP endpoint URL and a scoped API key, and paste them into Claude Desktop, ChatGPT, Cursor, or any MCP-compatible client. The client now sees your tenant’s tools — read products, search customers, draft emails, create orders, etc. Every call is scoped to your tenant, signed with your key, and logged. Revoke the key in one click.',
  },
  {
    id: 'static-4',
    order: 40,
    question: 'Where does my data live? Who owns it?',
    answer:
      'You own your data. sparx runs on Google Kubernetes Engine in us-central1 with Postgres backed up nightly. Multi-tenancy is enforced at the database level with row-level security — your data is isolated from every other tenant. Full export to JSON or SQL is available in the dashboard at any time, no support ticket required.',
  },
  {
    id: 'static-5',
    order: 50,
    question: 'Do you offer custom domains and SSL?',
    answer:
      'Yes, on every site. Add a domain, point your DNS, and we provision a Let’s Encrypt certificate automatically. Custom email-sending domains use Postal on sparx.email with auto-configured SPF, DKIM, and DMARC. No additional cost, no third-party DNS service required.',
  },
  {
    id: 'static-6',
    order: 60,
    question: 'Can I migrate from another platform?',
    answer:
      'Yes. We ship native importers for the common stacks — products, customers, and orders from store platforms; contacts, deals, and lists from CRMs; audiences and automations from email tools; posts, media, and redirects from CMSs. Most SMB migrations take under a week; a complex B2B move with custom checkout work runs about two.',
  },
  {
    id: 'static-7',
    order: 70,
    question: 'What about uptime and support?',
    answer:
      'A 99.95% uptime target, with a public status page at status.sparx.works. Every tenant gets email support; higher-touch support (faster response, a dedicated channel, a stronger SLA) is available, and managed-hosting clients get on-call infrastructure support included.',
  },
];

/**
 * The marketing FAQ section — an "index + spread": a rail of questions drives a
 * single answer panel (FaqSpread). The visible UI is interactive (client), but
 * the FAQPage JSON-LD is emitted HERE, server-side, from the same items — so the
 * questions and answers stay crawlable / answer-engine-extractable regardless of
 * what's on screen (the text an assistant quotes when a user asks about sparx in
 * their own AI chat). Reusable per page: pass page-specific `items` (never clone
 * one boilerplate FAQ across pages — duplicate Q&A is an anti-signal) and the
 * page's `accent` (the active rail dot + the "?" punctuation). Defaults: the
 * homepage set, Ember accent.
 */
export function Faq({
  items = FAQ_ITEMS,
  heading,
  lede,
  id,
  accent = 'var(--color-primary)',
  headlineSize,
  headlineLineHeight,
}: {
  /** Page-specific Q&A. Defaults to the homepage set. */
  items?: FaqItem[];
  heading?: ReactNode;
  lede?: ReactNode;
  /** Anchor id for in-page nav (e.g. "faq"). */
  id?: string;
  /** Section accent — the active rail dot + the "?" punctuation. Defaults to the Ember primary. */
  accent?: string;
  /** Override the headline's Display size (defaults to SectionHeader's own
   *  56px). Callers on a bigger-type page can pass a larger value so this
   *  section's type matches the rest of that page. The interactive
   *  FaqSpread accordion + the server-rendered FAQPage JSON-LD stay shared
   *  either way, so there's only ever one source of that structured data. */
  headlineSize?: number;
  headlineLineHeight?: number;
} = {}) {
  // FAQPage structured data (docs/50) — lets Google render rich FAQ results and
  // gives answer engines clean question/answer pairs to cite. Emitted server-side
  // from the same items FaqSpread renders, so the markup and the visible prose
  // never diverge and every answer stays extractable even when collapsed.
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  return (
    <Section id={id} padding="xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="flex flex-col gap-14">
        <SectionHeader
          headline={
            heading ?? (
              <>
                Frequently asked
                <Spark />
              </>
            )
          }
          lede={
            lede ?? (
              <>
                Still curious? Read the platform docs, browse the API spec, or book a 20-min
                architecture call. We don&apos;t do high-pressure demos.
              </>
            )
          }
          headlineSize={headlineSize}
          headlineLineHeight={headlineLineHeight}
        />
        <FaqSpread items={items} accent={accent} />
      </div>
    </Section>
  );
}
