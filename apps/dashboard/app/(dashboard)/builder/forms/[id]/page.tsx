import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Container,
  Heading,
  Stack,
  Text,
} from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import { SubmissionDetailActions } from './_components/submission-detail-actions';
import {
  DetailRow,
  SubmissionAttachments,
  SubmissionSidebar,
} from './_components/submission-detail-parts';
import { extraFields, submissionDisplayName, type FormSubmission } from '../types';

// A single submission — a read-only/transaction record (docs/86): it keeps its
// identity heading (no editable name field), and its status + lifecycle actions
// ride the frame header via SubmissionDetailActions. The message is UNTRUSTED and
// is rendered as escaped text (React default), NEVER as HTML.

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SubmissionDetailPage({ params }: PageProps) {
  const { id } = await params;

  let submission: FormSubmission;
  try {
    submission = await api.get<FormSubmission>(`/v1/forms/submissions/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  const displayName = submissionDisplayName(submission);
  const submittedAt = submission.context.submittedAt ?? submission.createdAt;
  const extras = extraFields(submission.fields);

  return (
    <Stack gap={0}>
      <div className="border-base-300 bg-base-100 flex h-[52px] shrink-0 items-center gap-2 border-b px-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/builder/forms">
            <ArrowLeft className="h-4 w-4" />
            Form submissions
          </Link>
        </Button>
        <div className="flex-1" />
        <SubmissionDetailActions id={submission.id} status={submission.status} name={displayName} />
      </div>

      <Container size="xl">
        <Stack gap={6} className="@container py-8">
          <Stack gap={1}>
            <Heading level={1}>{displayName}</Heading>
            <Text variant="muted">
              Submitted {new Date(submittedAt).toLocaleString()} · via{' '}
              {submission.formName ?? 'a contact form'}
            </Text>
          </Stack>

          <div className="grid grid-cols-1 gap-6 @[820px]:grid-cols-3">
            <div className="flex flex-col gap-6 @[820px]:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Message</CardTitle>
                </CardHeader>
                <CardContent>
                  {submission.message?.trim() ? (
                    <Text className="break-words whitespace-pre-wrap">{submission.message}</Text>
                  ) : (
                    <Text variant="muted" size="sm">
                      No message was included.
                    </Text>
                  )}
                </CardContent>
              </Card>

              {extras.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Other answers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Stack gap={3}>
                      {extras.map(([key, value]) => (
                        <DetailRow key={key} label={prettyLabel(key)} value={value} />
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              ) : null}

              <SubmissionAttachments submission={submission} />
            </div>

            <SubmissionSidebar submission={submission} submittedAt={submittedAt} />
          </div>
        </Stack>
      </Container>
    </Stack>
  );
}

// Turn a raw field key ("company_size") into a friendly label ("Company size").
function prettyLabel(key: string): string {
  const spaced = key.replace(/[_-]+/g, ' ').trim();
  return spaced ? spaced[0]!.toUpperCase() + spaced.slice(1) : key;
}
