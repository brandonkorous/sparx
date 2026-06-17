import type { Metadata } from 'next';
import { Nav } from '@/components/marketing/nav';
import { Footer } from '@/components/marketing/footer';
import { Container, Display, Dot, Spark } from '@/components/marketing/primitives';
import { EarlyAccessForm } from './early-access-form';

export const metadata: Metadata = {
  title: 'Early access — sparx',
  description:
    'sparx is the modular OS for content and commerce — storefront, CRM, CMS, email, B2B, and AI in one platform. Join the early-access list and we’ll bring you in.',
  alternates: { canonical: '/early' },
  openGraph: {
    title: 'Get early access to sparx',
    description:
      'One platform for content and commerce — built by AI, kept by you. Join the early-access list.',
    url: '/early',
    type: 'website',
  },
};

// What joining gets you — kept factual, no pricing promises.
const PERKS = [
  'An invite the moment the modules you need are ready',
  'A direct line to shape what we build next',
  'First look at every new module as it ships',
] as const;

export default function EarlyAccessPage() {
  return (
    <>
      <Nav />
      <section
        style={{
          paddingTop: 'clamp(72px, 10vw, 140px)',
          paddingBottom: 'clamp(72px, 10vw, 140px)',
          paddingLeft: 'var(--gutter-page)',
          paddingRight: 'var(--gutter-page)',
          backgroundColor: 'var(--color-bg-page)',
        }}
      >
        <Container>
          <div
            className="mkt-stack-on-tablet"
            style={{ alignItems: 'flex-start', gap: 'clamp(40px, 6vw, 80px)' }}
          >
            {/* ── Left: the pitch ─────────────────────────────────── */}
            <div
              style={{
                flex: '1 1 420px',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '28px',
              }}
            >
              <Display as="h1" size={80} lineHeight={76}>
                Be first on sparx
                <Spark />
              </Display>

              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '19px',
                  lineHeight: '31px',
                  color: 'var(--color-text-secondary)',
                  maxWidth: '560px',
                  margin: 0,
                }}
              >
                sparx is the modular OS for content and commerce — storefront, CRM, CMS, email, B2B,
                and AI in one platform that builds your site and keeps it. We&rsquo;re opening it up
                gradually. Join the list and we&rsquo;ll bring you in.
              </p>

              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                {PERKS.map((perk) => (
                  <li
                    key={perk}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '15px',
                      lineHeight: '24px',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    <span style={{ display: 'inline-flex', paddingTop: '9px', flexShrink: 0 }}>
                      <Dot />
                    </span>
                    {perk}
                  </li>
                ))}
              </ul>
            </div>

            {/* ── Right: the form card ────────────────────────────── */}
            <div style={{ width: '100%', maxWidth: '440px', flexShrink: 0 }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  padding: 'clamp(24px, 4vw, 36px)',
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: '16px',
                  boxShadow: '0 12px 40px rgba(9, 9, 11, 0.06)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 500,
                      fontSize: '20px',
                      letterSpacing: '-0.015em',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    Join the waitlist
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '14px',
                      lineHeight: '21px',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Takes ten seconds. We&rsquo;ll only reach out when it matters.
                  </span>
                </div>

                <EarlyAccessForm />
              </div>
            </div>
          </div>
        </Container>
      </section>
      <Footer />
    </>
  );
}
