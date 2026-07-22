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
    color: 'var(--color-module-commerce)',
  },
  {
    time: '10:40 AM',
    title: 'A wholesale buyer asks for pricing.',
    body: 'sparx recognizes the company, applies their price list and net terms, and drafts a quote from the same product catalog you already sell from.',
    result: 'Quote ready',
    color: 'var(--color-module-b2b)',
  },
  {
    time: '1:15 PM',
    title: "This week's post becomes an email, in one click.",
    body: 'Write it once in the CMS. Send it as a newsletter to your subscribers without re-typing a word or opening a second tool.',
    result: 'Newsletter sent',
    color: 'var(--color-module-cms)',
  },
  {
    time: '4:50 PM',
    title: 'You ask your AI what changed today.',
    body: 'Because sparx exposes live business data through MCP, your assistant answers with real orders, customers and inventory — not a stale export.',
    result: 'Answer grounded',
    color: 'var(--color-module-ai)',
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
    // A `data-theme="dark"` island: the whole `--color-base-*` ramp flips, so the
    // paneled system's content-tier rule (`--color-base-100 !important`) paints
    // this band dark and every ink resolves from `base-content`. `bg-base-100`
    // is the standalone fallback outside `.mkt-paneled`.
    <section
      id="day"
      data-theme="dark"
      className="mkt-inverse bg-base-100 px-page py-section-xl scroll-mt-20"
    >
      <Container className="flex flex-col gap-16">
        <Reveal className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-end">
          <Heading
            level={2}
            size="display"
            style={SECTION_DISPLAY_STYLE}
            className="text-base-content"
          >
            One ordinary day. One extraordinary advantage.
          </Heading>
          <Text variant="lead" className="text-base-content">
            sparx is most valuable in the moments that used to steal your attention. Here&apos;s
            what it feels like when your whole business shares one brain.
          </Text>
        </Reveal>

        <div className="relative">
          {/* Decorative rail — an alpha on a BACKGROUND, which the ink rule allows. */}
          <span
            aria-hidden
            className="bg-base-content/15 absolute top-1.5 bottom-1.5 left-[27px] w-px"
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
