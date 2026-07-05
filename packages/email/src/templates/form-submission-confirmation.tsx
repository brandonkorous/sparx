import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './_layout';
import { EmailHeading, EmailParagraph } from '../components';

// Submitter-facing autoresponder (docs/115) — the confirmation reply a visitor
// gets after submitting a contact form, when the site owner enables it. The body
// is the owner-authored `message`; the subject is the owner-authored `subject`.
export interface FormSubmissionConfirmationEmailProps {
  /** The customer-facing site name (Property.name). */
  siteName: string;
  name?: string | null;
  /** Owner-authored subject line (passed through to the send subject). */
  subject: string;
  /** Owner-authored confirmation body. */
  message: string;
}

export function FormSubmissionConfirmationEmail({
  siteName,
  name,
  message,
}: FormSubmissionConfirmationEmailProps) {
  return (
    <EmailLayout preview={`Thanks for contacting ${siteName}`}>
      <Section>
        <EmailHeading>Thanks{name ? `, ${name}` : ''}</EmailHeading>
        <EmailParagraph>{message}</EmailParagraph>
        <EmailParagraph>— The {siteName} team</EmailParagraph>
      </Section>
    </EmailLayout>
  );
}

export function formSubmissionConfirmationSubject(subject: string): string {
  return subject;
}
