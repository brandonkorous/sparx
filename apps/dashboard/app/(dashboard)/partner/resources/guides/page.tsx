import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import { Card, Container, ModuleProvider, PageHeader, Stack, Text } from '@sparx/ui';

import { MODULE_GUIDES } from '../_lib/content';

// Partner resource — module onboarding guides (docs/114 §B.7). Real, concise
// "get this module live for a client" playbooks — NOT links to marketing pages.
// Each guide wears its module's hue via a nested ModuleProvider (legit
// cross-module wayfinding). Content in _lib/content.ts.

export default function PartnerGuidesPage() {
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
            icon={<GraduationCap className="h-5 w-5" />}
            title="Onboarding guides"
            description="Step-by-step playbooks for getting each module live for a client. Use them yourself or hand them over."
          />

          <Stack gap={4}>
            {MODULE_GUIDES.map((guide) => (
              <ModuleProvider key={guide.module} module={guide.module}>
                <Card variant="module" padding="lg">
                  <Stack gap={3}>
                    <Stack gap={1}>
                      <Text weight="medium" className="text-[var(--module-active-text)]">
                        {guide.label}
                      </Text>
                      <Text size="sm" variant="muted">
                        {guide.blurb}
                      </Text>
                    </Stack>
                    <ol className="flex flex-col gap-2">
                      {guide.steps.map((step, i) => (
                        <li key={step} className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--module-active)] font-mono text-xs text-[var(--module-active-text)]">
                            {i + 1}
                          </span>
                          <Text size="sm">{step}</Text>
                        </li>
                      ))}
                    </ol>
                  </Stack>
                </Card>
              </ModuleProvider>
            ))}
          </Stack>
        </Stack>
      </Container>
    </ModuleProvider>
  );
}
