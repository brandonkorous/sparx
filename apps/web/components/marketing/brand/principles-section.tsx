import { Section, SectionHeader } from '../primitives';

const PRINCIPLES: { n: string; title: string; body: string }[] = [
  {
    n: '01',
    title: 'Flat by default',
    body: 'No gradients, drop shadows, or blur — except a functional focus ring. Depth comes from border contrast, never from elevation.',
  },
  {
    n: '02',
    title: 'Minimal chrome',
    body: 'The UI gets out of the way of the tenant’s work. Navigation is always visible but never dominant. Empty states are helpful, not decorative.',
  },
  {
    n: '03',
    title: 'One tinted card per module',
    body: 'A module’s color surfaces as a soft tint on a single lead card per section — a color-mix wash, never a loud stripe. One tinted card is wayfinding; a wall of them is noise, so the rest of the cards stay neutral.',
  },
  {
    n: '04',
    title: 'Module isolation',
    body: 'Work inside the CMS and the accents shift to teal; switch to AI and they shift to rose. The color transition reinforces context and makes the system feel coherent.',
  },
  {
    n: '05',
    title: 'Progressive disclosure',
    body: 'Advanced features — API keys, webhooks, MCP config, B2B pricing rules — exist but stay hidden from a new tenant. The five-minute path to a live site is always clear.',
  },
  {
    n: '06',
    title: 'Mobile-first, always',
    body: 'Every surface works from a 320px phone to a 2560px monitor. Display type uses fluid clamp() scaling; layouts reflow, they never just shrink.',
  },
];

export function PrinciplesSection() {
  return (
    <Section id="principles" surface="surface" padding="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
        <SectionHeader
          accent="var(--color-primary)"
          headline="Six principles that hold it together"
          lede="The brand is a set of decisions as much as a set of colors. These are the rules that make a sparx surface feel like sparx, whatever module you’re in."
        />

        <div className="mkt-grid-3-2-1">
          {PRINCIPLES.map((p) => (
            <div
              key={p.n}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                padding: '28px',
                backgroundColor: 'var(--color-base-200)',
                border: '1px solid var(--color-base-300)',
                borderRadius: 'var(--radius-xl)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                }}
              >
                {p.n}
              </span>
              <h3
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  fontSize: '18px',
                  letterSpacing: '-0.01em',
                  color: 'var(--color-base-content)',
                  margin: 0,
                }}
              >
                {p.title}
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  lineHeight: '22px',
                  color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                  margin: 0,
                }}
              >
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
