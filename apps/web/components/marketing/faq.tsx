import type { ReactNode } from 'react';
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
  Card,
  Heading,
  Text,
} from '@wizeworks/silicaui-react';
import { Reveal } from './reveal';

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
      'Yes, on every site. Add a domain, point your DNS, and we provision a Let’s Encrypt certificate automatically. Custom email-sending domains use Mailgun on sparx.email with auto-configured SPF, DKIM, and DMARC. No additional cost, no third-party DNS service required.',
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
 * The marketing FAQ section — ONE implementation, used by every page.
 *
 * ## Why this looks the way it does
 *
 * There were two FAQ designs on the site. This component rendered an "index +
 * spread" (a left rail of questions driving a single answer panel, built on the
 * bespoke `.mkt-faq-spread` / `.mkt-faq-rail` CSS) and served eleven module
 * pages, /bootcamp and /partners. Meanwhile landing and /pricing had each
 * hand-rolled a completely different one — a sticky headline beside silica's own
 * `<Accordion>` — in two near-identical files that knew nothing about each other
 * or about this one. Three copies, two designs, and adding a fourth page meant
 * picking a side.
 *
 * The accordion is the right one to keep, and not only because the two newest
 * pages chose it: it is silica's own answer. `@wizeworks/silicaui-html` ships a
 * `faq_accordion` block — a single-open disclosure list — as the FAQ primitive on
 * the builder path, so an accordion is what the design system already considers
 * an FAQ to be. There is no React equivalent to import (the React path exposes
 * `Accordion` and `Collapse` and nothing FAQ-shaped above them), which is why
 * this composition exists at all rather than being a re-skin of something
 * upstream.
 *
 * `faq-spread.tsx` and its two `.mkt-*` classes are deleted with it.
 *
 * ## What stays
 *
 * The FAQPage JSON-LD, emitted HERE, server-side, from the same `items` the
 * accordion renders — so questions and answers stay crawlable and
 * answer-engine-extractable no matter which panel is open. That is the text an
 * assistant quotes when someone asks about sparx in their own AI chat, and it is
 * the single highest-leverage reason this section exists.
 *
 * Pass page-specific `items` (never clone one boilerplate FAQ across pages —
 * duplicate Q&A is an anti-signal). Defaults are the homepage set.
 *
 * The `accent` prop is gone. Every module page passed one — a colour VALUE
 * (`var(--color-module-crm)`) that reached the DOM as an inline `style`, to tint
 * a rail dot and a "?" that no longer exist. Callers that want their hue on the
 * closing punctuation put it in `heading` themselves, which is where the rest of
 * the site already keeps it.
 */
export function Faq({
  items = FAQ_ITEMS,
  heading,
  lede,
  id,
}: {
  /** Page-specific Q&A. Defaults to the homepage set. */
  items?: FaqItem[];
  heading?: ReactNode;
  lede?: ReactNode;
  /** Anchor id for in-page nav (e.g. "faq"). */
  id?: string;
} = {}) {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
  const firstOpen = items[0]?.id;

  return (
    <section id={id} className="scroll-mt-20 px-6 py-24 sm:px-8 lg:py-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="mx-auto max-w-7xl">
        <Reveal className="grid grid-cols-1 gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
          <div className="flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
            <Heading
              level={2}
              size="display"
              className="text-6xl leading-[0.95] tracking-tight sm:text-7xl"
            >
              {heading ?? (
                <>
                  Frequently asked<span className="text-primary">.</span>
                </>
              )}
            </Heading>
            <Text variant="lead" className="max-w-xl text-2xl">
              {lede ?? (
                <>
                  Still curious? Read the platform docs, browse the API spec, or book a 20-min
                  architecture call. We don&apos;t do high-pressure demos.
                </>
              )}
            </Text>
          </div>

          {/* `shadow-none` because silica's Card ships one and this house does
              not use shadows as a visual device — the border and the surface
              shift do the separating. */}
          <Card className="bg-base-100 shadow-none">
            <Accordion defaultValue={firstOpen ? [firstOpen] : []}>
              {items.map((item) => (
                <AccordionItem key={item.id} value={item.id}>
                  <AccordionTrigger className="text-lg">{item.question}</AccordionTrigger>
                  <AccordionPanel>
                    <Text className="whitespace-pre-line">{item.answer}</Text>
                  </AccordionPanel>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>
        </Reveal>
      </div>
    </section>
  );
}
