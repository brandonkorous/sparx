import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';
import { Section, SectionHeader, Display, Spark, Text } from '../primitives';

const ROTATION = ['Commerce', 'Content', 'Customers', 'Email', 'Wholesale', 'AI', 'Everything'];

const TABLE: { instead: string; says: string }[] = [
  { instead: 'Start your free trial today', says: 'Live in 5 minutes.' },
  {
    instead: 'Powerful features for growing businesses',
    says: 'Pay for what you use. Own everything.',
  },
  {
    instead: 'Our AI-powered insights help you understand your customers',
    says: 'Ask your AI anything about your business.',
  },
  { instead: 'Flexible pricing for every stage', says: 'Add B2B for $99/mo. No upgrade required.' },
  { instead: 'Build a website with AI in seconds', says: 'AI builds it. sparx keeps it.' },
];

const PERMANENCE = [
  'Generated in a moment. Built to last.',
  'Coding optional. Permanence included.',
  'Your AI can start it. sparx is where it lives.',
];

export function VoiceSection() {
  return (
    <Section id="voice" surface="page" padding="lg">
      <div className="flex flex-col gap-14">
        <SectionHeader
          accent="var(--color-primary)"
          headline="sparx speaks directly"
          lede="No hedging, no corporate softness, no “revolutionary” or “game-changing.” Short sentences — subject, verb, done. Second person, present tense. sparx doesn’t explain itself; it demonstrates."
        />
        <TaglineBand />
        <VoiceTable />
        <PermanenceBand />
      </div>
    </Section>
  );
}

function TaglineBand() {
  return (
    <Card>
      <CardBody className="flex flex-col gap-6">
        <Display size={56} lineHeight={56}>
          Everything, ignited
          <Spark />
        </Display>
        <Text size={17} tone="muted" className="max-w-[640px]">
          The hero rotates the leading noun through the offerings — each landing on{' '}
          <em className="text-base-content not-italic">ignited.</em> with the Ember spark. Static
          form for titles, OG, and social:{' '}
          <strong className="text-base-content font-medium">Everything, ignited.</strong>
        </Text>
        <div className="flex flex-wrap items-center gap-2">
          {ROTATION.map((w) => (
            <Badge key={w} variant="soft" size="sm">
              {w}, ignited.
            </Badge>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function VoiceTable() {
  return (
    <div className="flex flex-col">
      {TABLE.map((row, i) => (
        <div
          key={row.says}
          className={`border-base-300 grid grid-cols-1 gap-6 border-b py-5 md:grid-cols-2 ${i === 0 ? 'border-t' : ''}`}
        >
          <Text
            as="span"
            size={15}
            tone="subtle"
            className="decoration-base-content/30 line-through"
          >
            {row.instead}
          </Text>
          <Text as="span" size={15} weight={500} tone="default">
            {row.says}
          </Text>
        </div>
      ))}
    </div>
  );
}

function PermanenceBand() {
  return (
    <Card data-theme="dark" className="bg-base-100">
      <CardBody className="flex flex-col gap-6">
        <Display size={48} lineHeight={50}>
          AI builds it. sparx keeps it
          <Spark />
        </Display>
        <Text size={15} className="max-w-[680px]">
          The durability story, for the era of disposable AI-generated sites. sparx is MCP-native —
          this is AI <em className="text-base-content not-italic">plus</em> permanence, never AI
          versus AI. Easy to create is table stakes now; easy to keep — maintain, enhance, own — is
          ours.
        </Text>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {PERMANENCE.map((line) => (
            <Text as="li" key={line} size={15} className="flex gap-3">
              <span aria-hidden className="text-primary">
                —
              </span>
              <span>{line}</span>
            </Text>
          ))}
        </ul>
        <Text as="span" size={12} mono tone="subtle">
          Use one supporting line at a time, never stacked.
        </Text>
      </CardBody>
    </Card>
  );
}
