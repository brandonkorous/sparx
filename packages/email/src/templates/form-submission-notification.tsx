import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './_layout';
import { EmailCallout, EmailHeading, EmailLink, EmailMuted, EmailParagraph } from '../components';

// Owner-facing notification when someone submits a Builder contact form on the
// site (docs/115). Carries the message + the submitter's contact details so the
// owner can reply straight from their inbox (api-rest sets reply-to = the
// submitter). Also stored in the dashboard "Form submissions" inbox.
export interface FormSubmissionNotificationEmailProps {
  /** The customer-facing site name (Property.name). */
  siteName: string;
  /** The form's author label (e.g. "Contact form"). */
  formName: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  /** The page the form was on (null = home). */
  pageSlug?: string | null;
  submittedAt?: string;
}

export function FormSubmissionNotificationEmail({
  siteName,
  formName,
  name,
  email,
  phone,
  message,
  pageSlug,
}: FormSubmissionNotificationEmailProps) {
  const who = name ?? email ?? 'Someone';
  return (
    <EmailLayout preview={`${who} sent a message via ${siteName}`}>
      <Section>
        <EmailHeading>New {formName.toLowerCase()} submission</EmailHeading>
        <EmailParagraph>
          {who} just reached out through {siteName}.
          {email ? (
            <>
              {' '}
              Reply straight to them at <EmailLink href={`mailto:${email}`}>{email}</EmailLink>.
            </>
          ) : null}
        </EmailParagraph>

        <EmailMuted>From</EmailMuted>
        {name ? <EmailParagraph flush>{name}</EmailParagraph> : null}
        {email ? (
          <EmailParagraph flush>
            <EmailLink href={`mailto:${email}`}>{email}</EmailLink>
          </EmailParagraph>
        ) : null}
        {phone ? <EmailParagraph flush>{phone}</EmailParagraph> : null}
        {!name && !email && !phone ? (
          <EmailParagraph flush>No contact details provided.</EmailParagraph>
        ) : null}

        {message ? (
          <>
            <EmailMuted>Message</EmailMuted>
            <EmailCallout tone="info">{message}</EmailCallout>
          </>
        ) : null}

        <EmailMuted>
          Submitted on {siteName}
          {pageSlug ? ` · /${pageSlug}` : ''}. This is saved in your form submissions.
        </EmailMuted>
      </Section>
    </EmailLayout>
  );
}

export function formSubmissionNotificationSubject(formName: string): string {
  return `New ${formName.toLowerCase()} submission`;
}
