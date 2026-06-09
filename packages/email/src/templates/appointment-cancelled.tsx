import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './_layout';
import { EmailHeading, EmailParagraph, EmailMuted, EmailCallout, EmailSpacer } from '../components';

export interface AppointmentCancelledEmailProps {
  customerName: string;
  serviceTypeName: string;
  scheduledAt: string; // ISO datetime string
  cancellationReason?: string;
  rebookUrl?: string;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export function AppointmentCancelledEmail({
  customerName,
  serviceTypeName,
  scheduledAt,
  cancellationReason,
  rebookUrl,
}: AppointmentCancelledEmailProps) {
  const previewText = `Your ${serviceTypeName} appointment has been cancelled`;

  return (
    <EmailLayout preview={previewText}>
      <Section>
        <EmailHeading>Appointment cancelled</EmailHeading>
        <EmailParagraph>Hi {customerName},</EmailParagraph>
        <EmailParagraph>
          Your <strong>{serviceTypeName}</strong> appointment scheduled for{' '}
          {formatDateTime(scheduledAt)} has been cancelled.
        </EmailParagraph>
      </Section>

      {cancellationReason ? (
        <EmailCallout>
          <EmailMuted>Reason</EmailMuted>
          <EmailParagraph flush>{cancellationReason}</EmailParagraph>
        </EmailCallout>
      ) : null}

      {rebookUrl ? (
        <>
          <EmailSpacer />
          <EmailParagraph>
            To schedule a new appointment, visit: <a href={rebookUrl}>{rebookUrl}</a>
          </EmailParagraph>
        </>
      ) : null}
    </EmailLayout>
  );
}

export const appointmentCancelledSubject = (serviceTypeName: string) =>
  `Your ${serviceTypeName} appointment has been cancelled`;
