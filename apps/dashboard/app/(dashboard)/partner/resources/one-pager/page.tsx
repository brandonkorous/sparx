import Link from 'next/link';
import { BookOpen, Check } from 'lucide-react';
import { Card, CardBody } from 'silicaui-react';
import { ModuleProvider, PageHeader } from '@sparx/ui';

import { ONE_PAGER } from '../_lib/content';
import { PrintButton } from '../_components/print-button';

// Partner resource — the Sparx one-pager (docs/114 §B.7). A printable single-page
// overview a partner can hand a client. Content in _lib/content.ts.

export default function PartnerOnePagerPage() {
  return (
    <ModuleProvider module="partner">
      <div className="mx-auto w-full max-w-screen-md px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 py-10">
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

          <Card>
            <CardBody>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <h2 className="text-2xl font-semibold tracking-tight">{ONE_PAGER.tagline}</h2>
                  <p className="text-base">{ONE_PAGER.what}</p>
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-base font-medium">What’s inside</p>
                  <ul className="flex flex-col gap-1.5">
                    {ONE_PAGER.modules.map((m) => (
                      <li key={m} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--module-active)]" />
                        <p className="text-sm">{m}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col gap-1">
                  <p className="text-base font-medium">Pricing</p>
                  <p className="text-base-content/70 text-sm">{ONE_PAGER.pricing}</p>
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-base font-medium">Best for</p>
                  <ul className="flex flex-col gap-1.5">
                    {ONE_PAGER.bestFor.map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <span
                          aria-hidden
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--module-active)]"
                        />
                        <p className="text-base-content/70 text-sm">{b}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </ModuleProvider>
  );
}
