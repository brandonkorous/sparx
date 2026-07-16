import Link from 'next/link';
import { Download, Globe, Mail, Paperclip, Phone, UserCheck } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ModuleProvider,
  Stack,
  Text,
} from '@sparx/ui';

import { attachmentDownloadHref, formatBytes, type FormSubmission } from '../../types';

// The rail beside a submission's message: how to reach the person, whether they
// were mirrored into the CRM (in CRM cyan via a nested ModuleProvider), and where
// the submission came from. Split out of the detail page so the page body stays
// readable.
export function SubmissionSidebar({
  submission,
  submittedAt,
}: {
  submission: FormSubmission;
  submittedAt: string;
}) {
  return (
    <Stack gap={6}>
      <Card variant="module">
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent>
          <Stack gap={3}>
            {submission.email ? (
              <Stack direction="row" align="center" gap={2}>
                <Mail className="text-base-content h-4 w-4 shrink-0" />
                <a
                  href={`mailto:${submission.email}`}
                  className="text-module break-all hover:underline"
                >
                  {submission.email}
                </a>
              </Stack>
            ) : (
              <Text variant="muted" size="sm">
                No email address.
              </Text>
            )}
            {submission.phone ? (
              <Stack direction="row" align="center" gap={2}>
                <Phone className="text-base-content h-4 w-4 shrink-0" />
                <a href={`tel:${submission.phone}`} className="text-module hover:underline">
                  {submission.phone}
                </a>
              </Stack>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      {submission.customerId ? (
        <ModuleProvider module="crm">
          <Card variant="module">
            <CardHeader>
              <Stack direction="row" align="center" gap={2}>
                <UserCheck className="h-4 w-4" />
                <CardTitle>In your contacts</CardTitle>
              </Stack>
            </CardHeader>
            <CardContent>
              <Stack gap={3}>
                <Text size="sm" variant="muted">
                  This person was added to your CRM as a contact.
                </Text>
                <Button asChild size="sm" color="module" variant="outline">
                  <Link href={`/crm/customers/${submission.customerId}`}>Open contact</Link>
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </ModuleProvider>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Where it came from</CardTitle>
        </CardHeader>
        <CardContent>
          <Stack gap={3}>
            <DetailRow
              label="Page"
              value={submission.pageSlug ? `/${submission.pageSlug}` : 'Unknown'}
            />
            {submission.context.referrer ? (
              <DetailRow
                label="Referrer"
                value={submission.context.referrer}
                icon={<Globe className="h-3.5 w-3.5" />}
              />
            ) : null}
            <DetailRow label="Received" value={new Date(submittedAt).toLocaleString()} />
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

// The files a visitor attached (docs/115 Part D). Each downloads through the
// authenticated same-origin route (addressed by index — the private storage key
// never reaches the browser). Rendered in the main column, below the message.
export function SubmissionAttachments({ submission }: { submission: FormSubmission }) {
  if (submission.attachments.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <Stack direction="row" align="center" gap={2}>
          <Paperclip className="h-4 w-4" />
          <CardTitle>
            {submission.attachments.length === 1
              ? 'Attachment'
              : `Attachments (${submission.attachments.length})`}
          </CardTitle>
        </Stack>
      </CardHeader>
      <CardContent>
        <Stack gap={2}>
          {submission.attachments.map((att, i) => (
            <div
              key={`${att.filename}-${i}`}
              className="border-base-300 flex items-center justify-between gap-3 rounded-[var(--radius-md)] border px-3 py-2"
            >
              <Stack gap={0} className="min-w-0">
                <Text size="sm" className="truncate font-medium">
                  {att.filename}
                </Text>
                {formatBytes(att.byteSize) ? (
                  <Text size="xs" variant="muted">
                    {formatBytes(att.byteSize)}
                  </Text>
                ) : null}
              </Stack>
              <Button asChild size="sm" variant="outline">
                <a href={attachmentDownloadHref(submission.id, i)}>
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </Button>
            </div>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

// A label + value stack, with an optional leading icon. Shared by the sidebar and
// the "Other answers" card.
export function DetailRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <Stack gap={1}>
      <Text size="xs" variant="muted">
        {label}
      </Text>
      <Stack direction="row" align="center" gap={2}>
        {icon ? <span className="text-base-content">{icon}</span> : null}
        <Text size="sm" className="break-words">
          {value}
        </Text>
      </Stack>
    </Stack>
  );
}
