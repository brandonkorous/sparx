import * as React from 'react';
import { Section, SectionHeader, Display, Spark } from '../primitives';

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '56px' }}>
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        padding: 'clamp(28px, 5vw, 48px)',
        border: '1px solid var(--color-base-300)',
        borderRadius: 'var(--radius-xl)',
        backgroundColor: 'var(--color-base-100)',
      }}
    >
      <Display size={56} lineHeight={56}>
        Everything, ignited
        <Spark />
      </Display>
      <p style={lede}>
        The hero rotates the leading noun through the offerings — each landing on{' '}
        <em style={{ fontStyle: 'normal', color: 'var(--color-base-content)' }}>ignited.</em> with
        the indigo spark. Static form for titles, OG, and social:{' '}
        <strong style={{ color: 'var(--color-base-content)', fontWeight: 500 }}>
          Everything, ignited.
        </strong>
      </p>
      <div className="mkt-cluster" style={{ gap: '8px' }}>
        {ROTATION.map((w) => (
          <span
            key={w}
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '14px',
              color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              padding: '6px 12px',
              border: '1px solid var(--color-base-300)',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-base-200)',
            }}
          >
            {w}, ignited.
          </span>
        ))}
      </div>
    </div>
  );
}

function VoiceTable() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {TABLE.map((row, i) => (
        <div
          key={row.says}
          className="mkt-grid-2-1"
          style={{
            gap: '16px',
            padding: '20px 0',
            borderTop: i === 0 ? '1px solid var(--color-base-300)' : 'none',
            borderBottom: '1px solid var(--color-base-300)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '15px',
              lineHeight: '24px',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              textDecoration: 'line-through',
              textDecorationColor:
                'color-mix(in oklab, var(--color-base-content) 30%, transparent)',
            }}
          >
            {row.instead}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              fontSize: '15px',
              lineHeight: '24px',
              color: 'var(--color-base-content)',
            }}
          >
            {row.says}
          </span>
        </div>
      ))}
    </div>
  );
}

function PermanenceBand() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        padding: 'clamp(32px, 5vw, 56px)',
        borderRadius: 'var(--radius-xl)',
        backgroundColor: '#0A0A0A',
      }}
    >
      <Display size={48} lineHeight={50} color="#FFFFFF">
        AI builds it. sparx keeps it
        <Spark color="#818CF8" />
      </Display>
      <p style={{ ...lede, color: '#A1A1AA', maxWidth: '680px' }}>
        The durability story, for the era of disposable AI-generated sites. sparx is MCP-native —
        this is AI <em style={{ fontStyle: 'normal', color: '#fff' }}>plus</em> permanence, never AI
        versus AI. Easy to create is table stakes now; easy to keep — maintain, enhance, own — is
        ours.
      </p>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {PERMANENCE.map((line) => (
          <li
            key={line}
            style={{
              display: 'flex',
              gap: '12px',
              fontFamily: 'var(--font-sans)',
              fontSize: '15px',
              lineHeight: '24px',
              color: '#D4D4D8',
            }}
          >
            <span aria-hidden style={{ color: '#818CF8' }}>
              —
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#52525B' }}>
        Use one supporting line at a time, never stacked.
      </span>
    </div>
  );
}

const lede: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: '17px',
  lineHeight: '28px',
  color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
  margin: 0,
  maxWidth: '640px',
};
