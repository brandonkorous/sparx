import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './_layout';
import {
  EmailButton,
  EmailCallout,
  EmailHeading,
  EmailLink,
  EmailMuted,
  EmailParagraph,
} from '../components';

// Internal notification to the sparx team when someone applies on /careers.
// Not a customer-facing email — it carries the applicant's details and a signed
// link to their résumé so a reviewer can act straight from the inbox.
export interface JobApplicationReceivedEmailProps {
  roleTitle: string;
  applicantName: string;
  applicantEmail: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  roleInterest?: string;
  coverLetter?: string;
  /** Short-lived signed URL to the résumé PDF (private bucket). */
  resumeUrl?: string;
  resumeFilename?: string;
}

export function JobApplicationReceivedEmail({
  roleTitle,
  applicantName,
  applicantEmail,
  phone,
  location,
  linkedinUrl,
  portfolioUrl,
  roleInterest,
  coverLetter,
  resumeUrl,
  resumeFilename,
}: JobApplicationReceivedEmailProps) {
  return (
    <EmailLayout preview={`${applicantName} applied — ${roleTitle}`}>
      <Section>
        <EmailHeading>New application — {roleTitle}</EmailHeading>
        <EmailParagraph>
          {applicantName} just applied. Reply straight to them at{' '}
          <EmailLink href={`mailto:${applicantEmail}`}>{applicantEmail}</EmailLink>.
        </EmailParagraph>

        <EmailMuted>Applicant</EmailMuted>
        <EmailParagraph flush>{applicantName}</EmailParagraph>
        <EmailParagraph flush>
          <EmailLink href={`mailto:${applicantEmail}`}>{applicantEmail}</EmailLink>
        </EmailParagraph>
        {phone ? <EmailParagraph flush>{phone}</EmailParagraph> : null}
        {location ? <EmailParagraph flush>{location}</EmailParagraph> : null}

        {linkedinUrl || portfolioUrl ? (
          <>
            <EmailMuted>Links</EmailMuted>
            {linkedinUrl ? (
              <EmailParagraph flush>
                LinkedIn: <EmailLink href={linkedinUrl}>{linkedinUrl}</EmailLink>
              </EmailParagraph>
            ) : null}
            {portfolioUrl ? (
              <EmailParagraph flush>
                Portfolio: <EmailLink href={portfolioUrl}>{portfolioUrl}</EmailLink>
              </EmailParagraph>
            ) : null}
          </>
        ) : null}

        {roleInterest ? (
          <>
            <EmailMuted>What they want to own</EmailMuted>
            <EmailParagraph flush>{roleInterest}</EmailParagraph>
          </>
        ) : null}

        {coverLetter ? (
          <>
            <EmailMuted>Cover note</EmailMuted>
            <EmailCallout tone="info">{coverLetter}</EmailCallout>
          </>
        ) : null}

        {resumeUrl ? (
          <EmailButton href={resumeUrl}>
            View résumé{resumeFilename ? ` (${resumeFilename})` : ''}
          </EmailButton>
        ) : (
          <EmailMuted>No résumé attached.</EmailMuted>
        )}

        <EmailMuted>This is stored in the careers pipeline for the admin app.</EmailMuted>
      </Section>
    </EmailLayout>
  );
}

export function jobApplicationReceivedSubject(roleTitle: string): string {
  return `New application — ${roleTitle}`;
}
