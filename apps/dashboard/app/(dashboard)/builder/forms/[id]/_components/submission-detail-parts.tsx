import Link from 'next/link';
import { Globe, Mail, Phone, UserCheck } from 'lucide-react';
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

import type { FormSubmission } from '../../types';

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
                <Mail className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
                <a
                  href={`mailto:${submission.email}`}
                  className="break-all text-[var(--module-active)] hover:underline"
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
                <Phone className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
                <a
                  href={`tel:${submission.phone}`}
                  className="text-[var(--module-active)] hover:underline"
                >
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
        {icon ? <span className="text-[var(--color-text-tertiary)]">{icon}</span> : null}
        <Text size="sm" className="break-words">
          {value}
        </Text>
      </Stack>
    </Stack>
  );
}
