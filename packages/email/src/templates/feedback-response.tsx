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

// In-product feedback — "WizeWorks replied to your feedback" notification
// (docs/112 §8). Published as an `email.send` event when staff respond to a
// submission from the admin portal (docs/apps/admin/feedback.md §6). Closes the
// loop back to the original submitter alongside the in-app unread dot.

export interface FeedbackResponseEmailProps {
  /** The submitter's name (or null → a neutral greeting). */
  recipientName?: string | null;
  /** What they sent us, so the reply has context (subject or first line). */
  feedbackTitle: string;
  /** Our reply body. */
  responseBody: string;
  /** Who replied, e.g. "Brandon from sparx". */
  responderName: string;
  /** Optional human status label when the response carried a status change
   *  (e.g. "Shipped", "Planned", "Won't do"). */
  statusLabel?: string;
  /** Deep link to the thread in the dashboard (the Your-feedback history view). */
  threadUrl: string;
}

export function FeedbackResponseEmail({
  recipientName,
  feedbackTitle,
  responseBody,
  responderName,
  statusLabel,
  threadUrl,
}: FeedbackResponseEmailProps) {
  return (
    <EmailLayout preview={`${responderName} replied to your feedback`}>
      <Section>
        <EmailHeading>We replied to your feedback</EmailHeading>
        <EmailParagraph>{recipientName ? `Hi ${recipientName},` : 'Hi there,'}</EmailParagraph>
        <EmailParagraph>
          Thanks for taking the time to share this with us. {responderName} replied to your feedback
          {statusLabel ? ` and marked it “${statusLabel}”` : ''}:
        </EmailParagraph>
        <EmailMuted>Your feedback: {feedbackTitle}</EmailMuted>
        <EmailCallout tone="info">{responseBody}</EmailCallout>
        <EmailButton href={threadUrl}>View the conversation</EmailButton>
        <EmailParagraph flush>
          You can reply right from the thread: <EmailLink href={threadUrl}>{threadUrl}</EmailLink>
        </EmailParagraph>
        <EmailMuted>
          You&apos;re receiving this because you submitted feedback in your sparx dashboard.
        </EmailMuted>
      </Section>
    </EmailLayout>
  );
}

export function feedbackResponseSubject(feedbackTitle: string): string {
  return `Re: your feedback — ${feedbackTitle}`;
}
