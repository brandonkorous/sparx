import type { Metadata } from 'next';
import { Container, Display, Spark } from '@/components/marketing/primitives';
import { LegalSection, LegalP, LegalList } from '@/components/marketing/legal-doc';

export const metadata: Metadata = {
  title: 'Security — sparx',
  description:
    'How sparx protects your data: database-level tenant isolation, encryption everywhere, phishing-resistant sign-in, and a written policy for government data requests.',
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

            <LegalSection heading="Signing in">
              <LegalP>
                Every account can turn on a second step at sign-in, and we support two kinds.
                Passkeys are the stronger one — the secret never leaves your device, so there is
                nothing for a fake sign-in page to steal. Authenticator apps work anywhere, on any
                phone. Backup codes are stored encrypted rather than in plain text, so a database
                copy does not hand anyone ten working ways into your account.
              </LegalP>
            </LegalSection>

            <LegalSection heading="Access & data handling">
              <LegalList
                items={[
                  'Personal information is excluded from application logs and masked in error reporting.',
                  'Administrative access is restricted to personnel who need it and is logged. Our support staff cannot assume your session — there is no impersonation.',
                  'Payments run through a PCI-compliant processor — we never store raw card numbers.',
                  'Credentials you connect — social accounts, AI keys, payment gateways — are encrypted at rest and never displayed back to you once saved.',
                  'We hold no AI credential of our own, so your data is never sent to an AI provider on our account and is never used to train a model.',
                ]}
              />
            </LegalSection>

            <LegalSection heading="Government & law-enforcement requests">
              <LegalP>
                We have a written policy for what happens when an authority demands data, and we
                follow it before anything is disclosed: check that the request is a valid legal
                instrument, challenge it if it is unlawful or overbroad, disclose only the minimum
                it compels, tell the affected customer unless a court order forbids it, and log
                every request — including the ones we refuse. Section 10 of the{' '}
                <a href="/legal/privacy">Privacy Policy</a> and section 9 of the{' '}
                <a href="/legal/dpa">DPA</a> set out the commitment in full.
              </LegalP>
            </LegalSection>

            <LegalSection heading="Compliance">
              <LegalP>
                We offer a GDPR/CCPA-aligned <a href="/legal/dpa">Data Processing Addendum</a>, we
                publish the full list of{' '}
                <a href="/legal/subprocessors">companies that handle data on our behalf</a>, and our{' '}
                <a href="/legal/privacy">Privacy Policy</a> describes how we handle personal data as
                both a controller and a processor.
              </LegalP>
              <LegalP>
                We build to the controls a SOC 2 examination covers, but we have not completed one
                and hold no SOC 2 report today. We would rather tell you that than imply a
                certificate we cannot produce. When an examination is underway we will say so here,
                with the auditor and the period named, and the report itself will be available under
                NDA.
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
