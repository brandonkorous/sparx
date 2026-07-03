import Link from 'next/link';
import { BookOpen, Check } from 'lucide-react';
import { Card, Container, Heading, ModuleProvider, PageHeader, Stack, Text } from '@sparx/ui';

import { ONE_PAGER } from '../_lib/content';
import { PrintButton } from '../_components/print-button';

// Partner resource — the Sparx one-pager (docs/114 §B.7). A printable single-page
// overview a partner can hand a client. Content in _lib/content.ts.

export default function PartnerOnePagerPage() {
  return (
    <ModuleProvider module="partner">
      <Container size="md">
        <Stack gap={8} className="py-10">
          <Link
            href="/partner/resources"
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            ← Resources
          </Link>
          <PageHeader
            icon={<BookOpen className="h-5 w-5" />}
            title="Sparx, on one page"
            description="A single-page overview to hand a client. Print it or save it as a PDF."
            actions={<PrintButton />}
          />

          <Card variant="default" padding="lg">
            <Stack gap={6}>
              <Stack gap={2}>
                <Heading level={2}>{ONE_PAGER.tagline}</Heading>
                <Text>{ONE_PAGER.what}</Text>
              </Stack>

              <Stack gap={2}>
                <Text weight="medium">What’s inside</Text>
                <ul className="flex flex-col gap-1.5">
                  {ONE_PAGER.modules.map((m) => (
                    <li key={m} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--module-active)]" />
                      <Text size="sm">{m}</Text>
                    </li>
                  ))}
                </ul>
              </Stack>

              <Stack gap={1}>
                <Text weight="medium">Pricing</Text>
                <Text size="sm" variant="muted">
                  {ONE_PAGER.pricing}
                </Text>
              </Stack>

              <Stack gap={2}>
                <Text weight="medium">Best for</Text>
                <ul className="flex flex-col gap-1.5">
                  {ONE_PAGER.bestFor.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <span
                        aria-hidden
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--module-active)]"
                      />
                      <Text size="sm" variant="muted">
                        {b}
                      </Text>
                    </li>
                  ))}
                </ul>
              </Stack>
            </Stack>
          </Card>
        </Stack>
      </Container>
    </ModuleProvider>
  );
}
