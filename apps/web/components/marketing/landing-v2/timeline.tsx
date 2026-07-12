import { Badge, Card, CardBody, CardTitle, Heading, Text } from '@wizeworks/silicaui-react';
import { Container } from '../primitives';
import { Reveal } from '../reveal';
import { SECTION_DISPLAY_STYLE } from './heading-style';

// "One ordinary day" — a chronological walk through moments across several
// modules (commerce, B2B, CMS/email, AI), deliberately spanning both content
// and selling rather than leaning on one vertical. Each moment is a real
// silicaui Card; the result badge uses `success` (state is its own color
// axis) rather than the module hue, which stays on the small index chip only.

const MOMENTS = [
  {
    time: '7:12 AM',
    title: 'An order lands before you open.',
    body: 'Inventory updates, payment clears, the customer record updates, and a pickup message is scheduled — automatically, with no integration to configure.',
    result: 'Order handled',
    color: '#F97316',
  },
  {
    time: '10:40 AM',
    title: 'A wholesale buyer asks for pricing.',
    body: 'sparx recognizes the company, applies their price list and net terms, and drafts a quote from the same product catalog you already sell from.',
    result: 'Quote ready',
    color: '#475569',
  },
  {
    time: '1:15 PM',
    title: "This week's post becomes an email, in one click.",
    body: 'Write it once in the CMS. Send it as a newsletter to your subscribers without re-typing a word or opening a second tool.',
    result: 'Newsletter sent',
    color: '#14B8A6',
  },
  {
    time: '4:50 PM',
    title: 'You ask your AI what changed today.',
    body: 'Because sparx exposes live business data through MCP, your assistant answers with real orders, customers and inventory — not a stale export.',
    result: 'Answer grounded',
    color: '#EC4899',
  },
  {
    time: '6:18 PM',
    title: 'You go home without doing software chores.',
    body: "Reports already agree. The customer list is current. Tomorrow's reminders are queued. The business closes; the system keeps working.",
    result: 'Evening reclaimed',
    color: 'var(--color-primary)',
  },
];

export function LandingV2Timeline() {
  return (
    <section
      id="day"
      className="mkt-accent px-[var(--gutter-page)] py-[var(--section-py-xl)]"
      style={{ scrollMarginTop: '80px' }}
    >
      <Container style={{ display: 'flex', flexDirection: 'column', gap: '64px' }}>
        <Reveal className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-end">
          <Heading level={2} size="display" style={SECTION_DISPLAY_STYLE} className="text-white">
            One ordinary day. One extraordinary advantage.
          </Heading>
          <Text variant="lead" style={{ color: '#A1A1AA' }}>
            sparx is most valuable in the moments that used to steal your attention. Here&apos;s
            what it feels like when your whole business shares one brain.
          </Text>
        </Reveal>

        <div className="relative">
          <span
            aria-hidden
            className="absolute top-1.5 bottom-1.5 left-[27px] w-px"
            style={{ backgroundColor: 'var(--color-neutral-content)', opacity: 0.15 }}
          />
          <div className="flex flex-col gap-5">
            {MOMENTS.map((m, i) => (
              <Reveal key={m.time} index={i}>
                <Moment moment={m} index={i} />
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

function Moment({ moment: m, index }: { moment: (typeof MOMENTS)[number]; index: number }) {
  return (
    <article className="flex items-start gap-5">
      <span
        className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-[15px] font-bold text-white"
        style={{ backgroundColor: m.color }}
      >
        {String(index + 1).padStart(2, '0')}
      </span>

      <Card className="flex-1">
        <CardBody className="gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Text variant="caption">{m.time}</Text>
            <Badge color="success" variant="soft">
              {m.result}
            </Badge>
          </div>
          <CardTitle className="text-xl">{m.title}</CardTitle>
          <Text className="max-w-xl">{m.body}</Text>
        </CardBody>
      </Card>
    </article>
  );
}
