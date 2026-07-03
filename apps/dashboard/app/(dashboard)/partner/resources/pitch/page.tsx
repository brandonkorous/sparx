import Link from 'next/link';
import { Presentation } from 'lucide-react';
import { Container, Heading, ModuleProvider, PageHeader, Stack, Text } from '@sparx/ui';

import { PITCH_SECTIONS } from '../_lib/content';
import { PrintButton } from '../_components/print-button';

// Partner resource — the Sparx pitch (docs/114 §B.7). A real, presentable
// narrative a partner walks a client through on screen or prints. Content lives in
// _lib/content.ts (data-as-code) so it stays honest and in one place.

export default function PartnerPitchPage() {
  return (
    <ModuleProvider module="partner">
      <Container size="lg">
        <Stack gap={8} className="py-10">
          <Link
            href="/partner/resources"
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            ← Resources
          </Link>
          <PageHeader
            icon={<Presentation className="h-5 w-5" />}
            title="The Sparx pitch"
            description="A ready story to walk a client through — on screen or printed. Specific, honest, no jargon."
            actions={<PrintButton />}
          />
          <Stack gap={6}>
            {PITCH_SECTIONS.map((section) => (
              <Stack key={section.heading} gap={3}>
                <Heading level={2}>{section.heading}</Heading>
                <Text className="max-w-2xl">{section.body}</Text>
                {section.points ? (
                  <ul className="flex max-w-2xl flex-col gap-1.5">
                    {section.points.map((p) => (
                      <li key={p} className="flex items-start gap-2">
                        <span
                          aria-hidden
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--module-active)]"
                        />
                        <Text size="sm" variant="muted">
                          {p}
                        </Text>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Stack>
            ))}
          </Stack>
        </Stack>
      </Container>
    </ModuleProvider>
  );
}
