'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ExternalLink, XCircle } from 'lucide-react';
import { Button, Text, useConfirm } from '@sparx/ui';
import type { BootcampStatus } from '@sparx/partner-schemas';

import { setBootcampStatusAction } from '../actions';

// The bootcamp lifecycle controls, teleported into the SurfaceFrame header (the
// detail-header pattern — status/lifecycle actions live in the frame chrome, not
// the body). Publish is attempted for any tier and the certified-only gate is
// surfaced from the server verbatim; Cancel confirms first. A published bootcamp
// gets a Preview link to its public detail page.

export function BootcampStatusActions({
  id,
  status,
  slug,
}: {
  id: string;
  status: BootcampStatus;
  slug: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function run(next: BootcampStatus) {
    setError(null);
    startTransition(async () => {
      const result = await setBootcampStatusAction(id, next);
      if (!result.ok) {
        setError(result.error ?? 'Could not update status.');
        return;
      }
      router.refresh();
    });
  }

  async function cancel() {
    const ok = await confirm({
      title: 'Cancel this bootcamp?',
      description:
        'Registered attendees keep their spot on record, but the cohort is marked cancelled and drops out of the public directory.',
      confirmLabel: 'Cancel bootcamp',
      tone: 'danger',
    });
    if (ok) run('cancelled');
  }

  const canPublish = status === 'draft' || status === 'cancelled';

  return (
    <div className="flex items-center gap-2">
      {error && (
        <Text size="xs" variant="danger">
          {error}
        </Text>
      )}
      {status === 'published' && (
        <Button asChild size="sm" variant="ghost" color="neutral">
          <a href={`https://sparx.works/bootcamp/${slug}`} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            Preview
          </a>
        </Button>
      )}
      {status === 'published' && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          color="danger"
          onClick={() => void cancel()}
          disabled={pending}
          leftIcon={<XCircle className="h-4 w-4" />}
        >
          Cancel
        </Button>
      )}
      {canPublish && (
        <Button
          type="button"
          size="sm"
          color="module"
          onClick={() => run('published')}
          loading={pending}
          disabled={pending}
          leftIcon={<CheckCircle2 className="h-4 w-4" />}
        >
          Publish
        </Button>
      )}
    </div>
  );
}
