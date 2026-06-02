'use client';

// Non-blocking banner shown on the dashboard home when Sparx's platform legal
// docs have a newer material version the signed-in owner hasn't accepted
// (docs/42 §6). Mirrors the onboarding banner — a nudge, not a hard gate.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Heading, Stack, Text } from '@sparx/ui';
import { acceptCurrentLegal } from './legal-actions';

const LABELS: Record<string, string> = {
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
  dpa: 'Data Processing Addendum',
  aup: 'Acceptable Use Policy',
};
const LEGAL_BASE = 'https://sparx.works/legal';

export function LegalReacceptBanner({ staleDocs }: { staleDocs: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  if (staleDocs.length === 0) return null;

  function accept() {
    setError(null);
    startTransition(async () => {
      const res = await acceptCurrentLegal(staleDocs);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <Card variant="subtle">
      <Stack direction="row" align="center" justify="between" gap={4}>
        <Stack gap={1} className="flex-1">
          <Heading level={3}>Our legal terms have been updated</Heading>
          <Text size="sm" variant="muted">
            Please review the updated{' '}
            {staleDocs.map((doc, i) => (
              <React.Fragment key={doc}>
                {i > 0 ? (i === staleDocs.length - 1 ? ' and ' : ', ') : ''}
                <a
                  href={`${LEGAL_BASE}/${doc}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {LABELS[doc] ?? doc}
                </a>
              </React.Fragment>
            ))}
            , then accept to continue.
          </Text>
          {error ? (
            <Text size="sm" variant="danger">
              {error}
            </Text>
          ) : null}
        </Stack>
        <Button onClick={accept} disabled={pending} loading={pending}>
          Accept updates
        </Button>
      </Stack>
    </Card>
  );
}
