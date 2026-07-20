import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
  Heading,
  Text,
} from '@wizeworks/silicaui-react';
import { Container } from '../primitives';
import { Reveal } from '../reveal';
import { SECTION_DISPLAY_STYLE } from './heading-style';

// A full rebuild on silicaui's real Accordion — replacing the homepage's
// "index + spread" rail (a rail of questions drives one shared answer panel)
// with a straightforward single-open accordion, a much more common pattern
// that reads better as a beat inside a long-scroll story than a two-pane
// desktop-oriented widget. Content matches the homepage's real FAQ answers
// (not invented copy) so the FAQPage JSON-LD stays accurate; this section
// keeps its own JSON-LD since it's no longer sharing the homepage's Faq
// component.

const FAQ_ITEMS = [
  {
    id: 'five-minutes',
    question: 'Can I really get a live site in five minutes?',
    answer:
      'Yes — that’s the design target the entire platform is built around. Sign up, pick a theme, activate the modules you need, add a product, take an order. We measure new-tenant time-to-first-order and that number is the north star metric. If it takes longer for you, something is broken and we want to know.',
  },
  {
    id: 'turn-off-module',
    question: 'What happens if I turn a module off?',
    answer:
      'Billing stops on the next cycle. Your data stays exactly where it was. The module’s UI becomes inactive — but if you turn it back on a year later, every order, customer, and configuration is still there. We never charge for storage on inactive modules and we never delete your data without your explicit request.',
  },
  {
    id: 'mcp-integration',
    question: 'How does the MCP integration actually work?',
    answer:
      'You enable the AI module, copy your MCP endpoint URL and a scoped API key, and paste them into Claude Desktop, ChatGPT, Cursor, or any MCP-compatible client. The client now sees your tenant’s tools — read products, search customers, draft emails, create orders, etc. Every call is scoped to your tenant, signed with your key, and logged. Revoke the key in one click.',
  },
  {
    id: 'data-ownership',
    question: 'Where does my data live? Who owns it?',
    answer:
      'You own your data. sparx runs on Google Kubernetes Engine in us-central1 with Postgres backed up nightly. Multi-tenancy is enforced at the database level with row-level security — your data is isolated from every other tenant. Full export to JSON or SQL is available in the dashboard at any time, no support ticket required.',
  },
  {
    id: 'domains-ssl',
    question: 'Do you offer custom domains and SSL?',
    answer:
      'Yes, on every site. Add a domain, point your DNS, and we provision a Let’s Encrypt certificate automatically. Custom email-sending domains use Mailgun on sparx.email with auto-configured SPF, DKIM, and DMARC. No additional cost, no third-party DNS service required.',
  },
  {
    id: 'migrate',
    question: 'Can I migrate from another platform?',
    answer:
      'Yes. We ship native importers for the common stacks — products, customers, and orders from store platforms; contacts, deals, and lists from CRMs; audiences and automations from email tools; posts, media, and redirects from CMSs. Most SMB migrations take under a week; a complex B2B move with custom checkout work runs about two.',
  },
  {
    id: 'uptime-support',
    question: 'What about uptime and support?',
    answer:
      'A 99.95% uptime target, with a public status page at status.sparx.works. Every tenant gets email support; higher-touch support (faster response, a dedicated channel, a stronger SLA) is available, and managed-hosting clients get on-call infrastructure support included.',
  },
] as const;

export function LandingV2Faq() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  return (
    <section id="faq" className="px-page py-section-xl scroll-mt-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Container>
        <Reveal className="grid grid-cols-1 gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
          <div className="flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
            <Heading level={2} size="display" style={SECTION_DISPLAY_STYLE}>
              Frequently asked.
            </Heading>
            <Text variant="lead" className="max-w-sm">
              Still curious? Read the platform docs, browse the API spec, or book a 20-min
              architecture call. We don&apos;t do high-pressure demos.
            </Text>
          </div>

          <Accordion defaultValue={[FAQ_ITEMS[0].id]}>
            {FAQ_ITEMS.map((item) => (
              <AccordionItem key={item.id} value={item.id}>
                <AccordionTrigger className="text-lg">{item.question}</AccordionTrigger>
                <AccordionPanel>
                  <Text>{item.answer}</Text>
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </Container>
    </section>
  );
}
