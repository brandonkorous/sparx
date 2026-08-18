import type { Metadata } from 'next';
import { SUBPROCESSORS_VERSION } from '@/lib/legal-versions';
import { LegalDoc, LegalSection, LegalP, LegalList } from '@/components/marketing/legal-doc';

export const metadata: Metadata = {
  title: 'Subprocessors — sparx',
  description:
    'The third-party companies that help us run sparx, what each one does, and what data it handles.',
  alternates: { canonical: '/legal/subprocessors' },
};

const v = SUBPROCESSORS_VERSION;

export default function SubprocessorsPage() {
  return (
    <LegalDoc
      title="Subprocessors"
      version={v.version}
      effectiveDate={v.effectiveDate}
      intro={
        <>
          Running sparx means relying on a small number of other companies — to host the servers,
          deliver the email, and take the payments. This page names every one of them that touches
          personal data, and says exactly what it does with it.
        </>
      }
    >
      <LegalSection heading="1. What a subprocessor is">
        <LegalP>
          A subprocessor is a company that handles personal data <em>on our behalf</em> so that we
          can deliver sparx to you. Our <a href="/legal/dpa">Data Processing Addendum</a> requires
          us to keep this list current, to hold each company to data-protection terms no weaker than
          our own, and to give you notice before we add one — so you have the chance to object.
        </LegalP>
        <LegalP>
          Companies that never touch your data are not subprocessors and are deliberately left off
          this page. Our accounting software and our source-control host are vendors, not
          subprocessors, and listing them would only make the real list harder to read.
        </LegalP>
      </LegalSection>

      <LegalSection heading="2. The companies we use">
        <LegalP>
          These run on <strong>our</strong> accounts, on credentials we hold. They are our
          subprocessors, and we are responsible for them.
        </LegalP>
        <LegalList
          items={[
            <>
              <strong>Google Cloud Platform</strong> — all hosting, the database, uploaded files,
              background processing, and our secret storage. Every record and every file in your
              account lives here. This is the primary subprocessor; the others are narrow by
              comparison.
            </>,
            <>
              <strong>Cloudflare</strong> — the DNS, content delivery network, and encrypted
              connections in front of your sites. Handles traffic in transit and caches your public
              pages.
            </>,
            <>
              <strong>Mailgun</strong> — delivery of the email you send through sparx, and of our
              own account email. Handles recipient email addresses and the contents of the messages.
            </>,
            <>
              <strong>Twilio</strong> — delivery of text messages, where you have turned on SMS
              notifications such as appointment reminders. Handles recipient phone numbers and
              message contents.
            </>,
            <>
              <strong>Stripe</strong> — billing for your sparx subscription, and payouts to
              marketplace sellers and referral partners. Handles payer names, billing contacts, and
              payment metadata. Card numbers go to Stripe directly and never reach our systems.
            </>,
            <>
              <strong>GoDaddy</strong> — domain registration and DNS, when you buy a domain name
              through sparx. Handles the registrant contact details that domain-name rules require
              to be recorded against a domain.
            </>,
            <>
              <strong>PostHog</strong> — product analytics on our marketing site and in the sparx
              dashboard, so we can see which features get used. Handles usage events for your staff
              users only. It is never loaded on your own sites, so it never sees your customers, and
              it only runs at all for visitors who accept analytics cookies.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection heading="3. Services you connect yourself">
        <LegalP>
          sparx also talks to services that <strong>you</strong> choose and connect with your own
          account and your own credentials — shipping carriers and rate providers, tax-calculation
          services, payment gateways other than Stripe, AI providers, and social media platforms.
        </LegalP>
        <LegalP>
          These are a different arrangement. When sparx sends data to one of them, it does so at
          your instruction, on the relationship <em>you</em> already have with that company, under
          the terms <em>you</em> agreed to. They are not processing data on our behalf, so they are
          not our subprocessors — but you should account for them in your own privacy notice,
          because from your customers&rsquo; point of view they are still a place their data goes.
        </LegalP>
      </LegalSection>

      <LegalSection heading="4. Two things we do not use">
        <LegalP>
          <strong>We do not run AI on our own account.</strong> sparx holds no AI provider key of
          its own. Every AI feature — the site assistant, drafting help, the live-chat replies —
          runs on a key <em>you</em> supply, or through an AI tool you connect yourself. That means
          your data is never sent to an AI provider on our credential, and nothing in your account
          is used to train anyone&rsquo;s model, ours included.
        </LegalP>
        <LegalP>
          <strong>Our search index is not a vendor.</strong> Product and content search runs on
          software we host ourselves inside our own Google Cloud environment. Your data does not
          leave it, so there is no separate search company on this list.
        </LegalP>
      </LegalSection>

      <LegalSection heading="5. Where the data sits">
        <LegalP>
          Our infrastructure runs in Google Cloud&rsquo;s central United States region. If your
          business or your customers are outside the United States, that is a cross-border transfer,
          and we rely on the safeguards described in the{' '}
          <a href="/legal/dpa">Data Processing Addendum</a> to make it lawful.
        </LegalP>
      </LegalSection>

      <LegalSection heading="6. Changes & objections">
        <LegalP>
          When we add a subprocessor, we update this page and change the version and date at the
          top, and we notify account owners before the change takes effect. If you have a reasonable
          objection to a new subprocessor, email{' '}
          <a href="mailto:legal@sparx.works">legal@sparx.works</a> and we will work with you on it —
          the process is set out in section 6 of the DPA.
        </LegalP>
      </LegalSection>
    </LegalDoc>
  );
}
