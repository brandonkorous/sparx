import type { Metadata } from 'next';
import { Container, Display, Spark } from '@/components/marketing/primitives';
import { LegalSection, LegalP, LegalList } from '@/components/marketing/legal-doc';

export const metadata: Metadata = {
  title: 'Security — sparx',
  description:
    'How sparx protects your data: database-level tenant isolation, encryption everywhere, and an active SOC 2 program.',
  alternates: { canonical: '/security' },
};

export default function SecurityPage() {
  return (
    <>
      <section className="bg-base-200 px-page pt-[clamp(96px,11vw,150px)] pb-[clamp(32px,5vw,56px)]">
        <Container className="flex flex-col gap-5">
          <Display as="h1" size={64} lineHeight={64}>
            Security
            <Spark />
          </Display>
          <p className="text-lede text-ink-muted m-0 max-w-[640px] pt-2">
            Security is built into sparx&rsquo;s architecture, not bolted on. Here is how we protect
            your data and your customers&rsquo;.
          </p>
        </Container>
      </section>

      <section className="bg-base-200 px-page pb-[clamp(80px,10vw,140px)]">
        <Container>
          <div className="flex max-w-[760px] flex-col gap-10">
            <LegalSection heading="Tenant isolation">
              <LegalP>
                sparx is multi-tenant, and isolation is enforced at the database layer with
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
                sparx is undergoing a SOC 2 Type II examination. We offer a GDPR/CCPA-aligned{' '}
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
    </>
  );
}
