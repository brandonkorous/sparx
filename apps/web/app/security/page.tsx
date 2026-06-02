import type { Metadata } from 'next';
import { Nav } from '@/components/marketing/nav';
import { Footer } from '@/components/marketing/footer';
import { Container, Eyebrow, Display, Spark } from '@/components/marketing/primitives';
import { LegalSection, LegalP, LegalList } from '@/components/marketing/legal-doc';

export const metadata: Metadata = {
  title: 'Security — Sparx',
  description:
    'How Sparx protects your data: database-level tenant isolation, encryption everywhere, and an active SOC 2 program.',
  alternates: { canonical: '/security' },
};

export default function SecurityPage() {
  return (
    <>
      <Nav />
      <section
        style={{
          paddingTop: 'clamp(96px, 11vw, 150px)',
          paddingBottom: 'clamp(32px, 5vw, 56px)',
          paddingLeft: 'var(--gutter-page)',
          paddingRight: 'var(--gutter-page)',
          backgroundColor: 'var(--color-bg-page)',
        }}
      >
        <Container style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Eyebrow color="var(--color-text-tertiary)">Trust</Eyebrow>
          <Display as="h1" size={64} lineHeight={64}>
            Security
            <Spark />
          </Display>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '18px',
              lineHeight: '30px',
              color: 'var(--color-text-secondary)',
              maxWidth: '640px',
              margin: 0,
              paddingTop: '8px',
            }}
          >
            Security is built into Sparx&rsquo;s architecture, not bolted on. Here is how we protect
            your data and your customers&rsquo;.
          </p>
        </Container>
      </section>

      <section
        style={{
          paddingBottom: 'clamp(80px, 10vw, 140px)',
          paddingLeft: 'var(--gutter-page)',
          paddingRight: 'var(--gutter-page)',
          backgroundColor: 'var(--color-bg-page)',
        }}
      >
        <Container>
          <div style={{ maxWidth: '760px', display: 'flex', flexDirection: 'column', gap: '40px' }}>
            <LegalSection heading="Tenant isolation">
              <LegalP>
                Sparx is multi-tenant, and isolation is enforced at the database layer with
                PostgreSQL row-level security — not just in application code. Every tenant-scoped
                table carries a tenant id and a policy that makes cross-tenant reads impossible even
                if application logic has a bug. It is the backstop the rest of the platform is built
                on.
              </LegalP>
            </LegalSection>

            <LegalSection heading="Encryption">
              <LegalP>
                Data is encrypted in transit with TLS and at rest by default across our database,
                object storage, and backups. Secrets are managed through a dedicated secret store,
                never checked into source.
              </LegalP>
            </LegalSection>

            <LegalSection heading="Access & data handling">
              <LegalList
                items={[
                  'Personal information is excluded from application logs and masked in error reporting.',
                  'Administrative access is restricted to personnel who need it and is logged.',
                  'Payments run through a PCI-compliant processor — we never store raw card numbers.',
                ]}
              />
            </LegalSection>

            <LegalSection heading="Compliance">
              <LegalP>
                Sparx is undergoing a SOC 2 Type II examination. We offer a GDPR/CCPA-aligned{' '}
                <a href="/legal/dpa">Data Processing Addendum</a>, and our{' '}
                <a href="/legal/privacy">Privacy Policy</a> describes how we handle personal data as
                both a controller and a processor.
              </LegalP>
            </LegalSection>

            <LegalSection heading="Reporting a vulnerability">
              <LegalP>
                If you believe you have found a security issue, please email{' '}
                <a href="mailto:security@sparx.works">security@sparx.works</a>. We investigate all
                reports and will work with you on coordinated disclosure. A vendor security
                questionnaire and incident-response summary are available to customers on request.
              </LegalP>
            </LegalSection>
          </div>
        </Container>
      </section>
      <Footer />
    </>
  );
}
