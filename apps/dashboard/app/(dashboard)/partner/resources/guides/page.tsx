import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import { Card, CardBody } from 'silicaui-react';
import { ModuleProvider, PageHeader } from '@sparx/ui';

import { MODULE_GUIDES } from '../_lib/content';

// Partner resource — module onboarding guides (docs/114 §B.7). Real, concise
// "get this module live for a client" playbooks — NOT links to marketing pages.
// Each guide wears its module's hue via a nested ModuleProvider (legit
// cross-module wayfinding). Content in _lib/content.ts.

export default function PartnerGuidesPage() {
  return (
    <ModuleProvider module="partner">
      <div className="mx-auto w-full max-w-screen-lg px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 py-10">
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

          <div className="flex flex-col gap-4">
            {MODULE_GUIDES.map((guide) => (
              <ModuleProvider key={guide.module} module={guide.module}>
                <Card className="bg-module bg-soft">
                  <CardBody>
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <p className="text-base font-medium text-[var(--module-active-text)]">
                          {guide.label}
                        </p>
                        <p className="text-base-content/70 text-sm">{guide.blurb}</p>
                      </div>
                      <ol className="flex flex-col gap-2">
                        {guide.steps.map((step, i) => (
                          <li key={step} className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--module-active)] font-mono text-xs text-[var(--module-active-text)]">
                              {i + 1}
                            </span>
                            <p className="text-sm">{step}</p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </CardBody>
                </Card>
              </ModuleProvider>
            ))}
          </div>
        </div>
      </div>
    </ModuleProvider>
  );
}
