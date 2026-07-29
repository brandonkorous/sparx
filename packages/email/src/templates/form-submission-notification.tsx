import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './_layout';
import { EmailCallout, EmailHeading, EmailLink, EmailMuted, EmailParagraph } from '../components';

// Owner-facing notification when someone submits a Builder form on the site
// (docs/115). A form's fields are whatever named inputs the author composed, so the
// email renders the WHOLE ordered answer set — plus a reply-to summary for the
// recognized contact (api-rest sets reply-to = the submitter). Also stored in the
// dashboard "Form submissions" inbox.
export interface FormSubmissionNotificationEmailProps {
  /** The customer-facing site name (Property.name). Nullable defensively — it's only
   *  ever absent if the property row vanished between submit and send; falls back to a
   *  neutral phrase rather than crash. */
  siteName?: string | null;
  /** The form's author label (e.g. "Contact form"). Null when the form's settings panel
   *  was never opened (the commonest form flow) — falls back to a generic label. */
  formName?: string | null;
  /** The recognized contact email, for the reply summary (if the form has one). */
  email?: string | null;
  /** Best-effort submitter name for the intro line. */
  name?: string | null;
  /** Every submitted field, humanized + in submitted order — the full record. */
  answers?: { label: string; value: string }[];
  /** Filenames the visitor attached (docs/115 Part D) — listed, not linked (the
   *  files are private; the owner downloads them from the dashboard inbox). */
  attachmentNames?: string[];
  /** The page the form was on (null = home). */
  pageSlug?: string | null;
  submittedAt?: string | null;
}

export function FormSubmissionNotificationEmail({
  siteName,
  formName,
  email,
  name,
  answers,
  attachmentNames,
  pageSlug,
}: FormSubmissionNotificationEmailProps) {
  const who = name ?? email ?? 'Someone';
  const site = siteName ?? 'your site';
  const label = (formName ?? 'form').toLowerCase();
  const rows = (answers ?? []).filter((a) => a.value.trim() !== '');
  const files = (attachmentNames ?? []).filter((n) => n.trim() !== '');
  return (
    <EmailLayout preview={`${who} sent a message via ${site}`}>
      <Section>
        <EmailHeading>New {label} submission</EmailHeading>
        <EmailParagraph>
          {who} just reached out through {site}.
          {email ? (
            <>
              {' '}
              Reply straight to them at <EmailLink href={`mailto:${email}`}>{email}</EmailLink>.
            </>
          ) : null}
        </EmailParagraph>

        {rows.length > 0 ? (
          rows.map((a) => (
            <React.Fragment key={a.label}>
              <EmailMuted>{a.label}</EmailMuted>
              {a.value.includes('\n') ? (
                <EmailCallout tone="info">{a.value}</EmailCallout>
              ) : (
                <EmailParagraph flush>{a.value}</EmailParagraph>
              )}
            </React.Fragment>
          ))
        ) : (
          <EmailParagraph flush>No details were provided.</EmailParagraph>
        )}

        {files.length > 0 ? (
          <>
            <EmailMuted>{files.length === 1 ? 'Attachment' : 'Attachments'}</EmailMuted>
            <EmailParagraph flush>
              {files.join(', ')} — open your form submissions to download.
            </EmailParagraph>
          </>
        ) : null}

        <EmailMuted>
          Submitted on {site}
          {pageSlug ? ` · /${pageSlug}` : ''}. This is saved in your form submissions.
        </EmailMuted>
      </Section>
    </EmailLayout>
  );
}

export function formSubmissionNotificationSubject(formName?: string | null): string {
  return `New ${(formName ?? 'form').toLowerCase()} submission`;
}
