import type { Metadata } from 'next';
import { LEGAL_DOC_VERSIONS } from '@/lib/legal-versions';
import { LegalDoc, LegalSection, LegalP, LegalList } from '@/components/marketing/legal-doc';

export const metadata: Metadata = {
  title: 'Data processing addendum — sparx',
  description:
    'The GDPR/CCPA data processing addendum governing how sparx processes personal data on your behalf.',
  alternates: { canonical: '/legal/dpa' },
};

const v = LEGAL_DOC_VERSIONS.dpa;

export default function DpaPage() {
  return (
    <LegalDoc
      title="Data processing addendum"
      version={v.version}
      effectiveDate={v.effectiveDate}
      intro={
        <>
          This addendum forms part of the Terms of Service and governs our processing of personal
          data on your behalf. It applies whenever you use sparx to handle the personal data of your
          own customers or contacts.
        </>
      }
    >
      <LegalSection heading="1. Roles">
        <LegalP>
          For personal data contained in Customer Data, you are the <strong>controller</strong> and
          WizeWorks is the <strong>processor</strong> (or, where applicable, a service provider
          under U.S. state privacy laws). We process such personal data only on your documented
          instructions, which include the configuration choices you make in the Service and these
          Terms.
        </LegalP>
      </LegalSection>

      <LegalSection heading="2. Scope of processing">
        <LegalP>
          We process personal data to provide the Service — for example storing customer records in
          the CRM, processing orders and payments in commerce, delivering the email and text
          messages you send, taking bookings, running your live chat, publishing to the social
          accounts you connect, and rendering the content and stores you publish. The subject matter
          is the operation of your tenant; the duration is the term of your subscription plus any
          wind-down period.
        </LegalP>
      </LegalSection>

      <LegalSection heading="3. Categories of data & data subjects">
        <LegalP>
          <strong>Whose data:</strong> your end customers, contacts, leads, the recipients of your
          communications, people who book appointments with you, people who fill in your forms or
          chat with your site, and members of the public who comment on or review your business on a
          social platform you have connected.
        </LegalP>
        <LegalP>
          <strong>What data:</strong>
        </LegalP>
        <LegalList
          items={[
            'Identifiers and contact details — name, email, phone, addresses.',
            'Commercial records — orders, quotes, invoices, payment metadata, returns, and subscription history.',
            'Communication records — the email and text messages you send, whether they were delivered, opened, or clicked, unsubscribe and suppression state, and live-chat transcripts.',
            'Consent records — the cookie and marketing choices your visitors make on your sites, kept so you can evidence them.',
            'Scheduling records — appointments, attendees, and the details a booking captures.',
            'Form submissions — whatever your own forms ask for.',
            'Shopper accounts — where you let customers sign in to your site, their account credentials and sessions. Passwords are stored hashed and are not readable by us or by you.',
            'Push notification subscriptions — the browser tokens needed to send a notification, where a visitor has opted in.',
            'Social engagement data — the comments, mentions, reviews, and messages your connected social accounts receive, including the commenter’s public name, handle, and profile picture. See section 4.',
            'Site analytics — a count of visits to your sites, the pages hit, coarse country, and how each visit arrived. Visitors are counted with a salted identifier that rotates daily; we do not store visitor IP addresses in this data.',
          ]}
        />
        <LegalP>
          We do not require special-category data. If you choose to process it, you are responsible
          for the lawful basis and for any additional safeguards it requires.
        </LegalP>
      </LegalSection>

      <LegalSection heading="4. Data from social platforms">
        <LegalP>
          When you connect a social account, sparx receives data from that platform on your behalf —
          the posts you publish through it, how they performed, and the comments, mentions, reviews,
          and messages they attract. Some of that is personal data about members of the public who
          have no relationship with sparx and did not choose it.
        </LegalP>
        <LegalP>
          We handle it narrowly. It is used only to show you your own engagement and to send the
          replies you write, never for any purpose of our own; it is stored under the same tenant
          isolation as the rest of your data; and it is subject to the platform&rsquo;s own terms as
          well as this addendum, which means we honour a platform&rsquo;s instruction to delete it.
          The access tokens for a connected account are encrypted at rest with a key reserved for
          that purpose, and disconnecting an account removes them.
        </LegalP>
      </LegalSection>

      <LegalSection heading="5. Our obligations">
        <LegalList
          items={[
            'Process personal data only on your instructions and for no other purpose.',
            'Ensure personnel authorized to process data are bound by confidentiality.',
            'Implement appropriate technical and organizational security measures (see our security overview).',
            'Assist you, taking into account the nature of processing, in responding to data-subject requests and in meeting your security, breach-notification, and impact-assessment obligations.',
            'Delete or return personal data at the end of the relationship, subject to legal retention requirements.',
            'Make available information needed to demonstrate compliance and allow for audits within reasonable, agreed parameters.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="6. Subprocessors">
        <LegalP>
          You authorize us to engage subprocessors to deliver the Service. Each is named, with what
          it does and what data it handles, on our published{' '}
          <a href="/legal/subprocessors">subprocessor list</a>. We impose data-protection terms on
          each subprocessor no less protective than those in this addendum and remain responsible
          for their performance. We keep that list current and will give notice of material changes
          so you can object on reasonable grounds.
        </LegalP>
        <LegalP>
          Services <em>you</em> connect with your own credentials — shipping, tax, payment gateways
          other than our own, AI providers, and social platforms — are not our subprocessors. We
          transmit to them at your instruction, on your relationship with them. The subprocessor
          list explains the distinction.
        </LegalP>
      </LegalSection>

      <LegalSection heading="7. Artificial intelligence">
        <LegalP>
          <strong>
            We do not use your data to train AI models, and we do not send it to an AI provider on
            our own account.
          </strong>{' '}
          sparx holds no AI credential of its own. Where you enable an AI feature, it runs on a
          provider key you supply or through an AI tool you connect yourself, and that
          provider&rsquo;s terms — not ours — govern what it does with what it receives. If you do
          not configure one, no personal data in your tenant is sent to any AI provider at all.
        </LegalP>
      </LegalSection>

      <LegalSection heading="8. Security & breach notification">
        <LegalP>
          We maintain encryption in transit and at rest, database-level tenant isolation, and access
          controls — described in our <a href="/security">security overview</a>. If we become aware
          of a personal-data breach affecting your data, we will notify you without undue delay —
          and within 72 hours of confirming a reportable breach — with the information you
          reasonably need to meet your own notification duties.
        </LegalP>
      </LegalSection>

      <LegalSection heading="9. Requests from public authorities">
        <LegalP>
          If a court, regulator, or law-enforcement agency demands personal data we hold for you, we
          follow a written policy before anything is disclosed:
        </LegalP>
        <LegalList
          items={[
            'We review the request for legal validity first — that it is a genuine legal instrument, that it is directed at us in a jurisdiction with authority over us, and that it actually compels what it appears to. An informal request from an investigator is not a legal instrument and is refused in writing.',
            'We challenge requests that are unlawful, defective, or broader than the law allows — by objecting to the issuing body, negotiating the scope down, or moving to quash with counsel.',
            'We disclose the minimum the instrument compels. Production is scoped to the named accounts and dates, fields outside the request are redacted, and no other customer’s data is ever included.',
            'We tell you a request has arrived, so you can object yourself, unless a non-disclosure order or statute prohibits it. Where a gag is time-limited, we notify you when it lapses.',
            'We log every request, including the ones we refuse, with the reasoning and the outcome, and retain the log for at least seven years.',
          ]}
        />
        <LegalP>
          Because you are the controller of this data and we are only the processor, contesting a
          request is your decision to make wherever the law leaves room for one.
        </LegalP>
      </LegalSection>

      <LegalSection heading="10. International transfers">
        <LegalP>
          The Service runs in Google Cloud&rsquo;s central United States region, so personal data
          you process through sparx is stored in the United States. Where that is a cross-border
          transfer requiring safeguards, we rely on appropriate ones — including the European
          Commission&rsquo;s standard contractual clauses — to the extent required by applicable
          law.
        </LegalP>
      </LegalSection>

      <LegalSection heading="11. Return & deletion">
        <LegalP>
          On termination you may export Customer Data for a reasonable period. After that period we
          delete or anonymize personal data, except where we are required to retain it (for example,
          order records needed for tax and accounting), in which case it remains subject to these
          protections.
        </LegalP>
      </LegalSection>

      <LegalSection heading="12. Acceptance">
        <LegalP>
          This addendum is incorporated into the <a href="/legal/terms">Terms of Service</a>. A
          countersigned copy is available for organizations that require one — email{' '}
          <a href="mailto:legal@sparx.works">legal@sparx.works</a>. A signed DPA is required for
          tenants processing the personal data of individuals in the EU/EEA and UK.
        </LegalP>
      </LegalSection>
    </LegalDoc>
  );
}
