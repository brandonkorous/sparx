import Link from 'next/link';
import { Presentation } from 'lucide-react';
import { ModuleProvider, PageHeader } from '@sparx/ui';

import { PITCH_SECTIONS } from '../_lib/content';
import { PrintButton } from '../_components/print-button';

// Partner resource — the Sparx pitch (docs/114 §B.7). A real, presentable
// narrative a partner walks a client through on screen or prints. Content lives in
// _lib/content.ts (data-as-code) so it stays honest and in one place.

export default function PartnerPitchPage() {
  return (
    <ModuleProvider module="partner">
      <div className="mx-auto w-full max-w-screen-lg px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 py-10">
          <Link
            href="/partner/resources"
            className="text-base-content hover:text-base-content text-sm"
          >
            ← Resources
          </Link>
          <PageHeader
            icon={<Presentation className="h-5 w-5" />}
            title="The Sparx pitch"
            description="A ready story to walk a client through — on screen or printed. Specific, honest, no jargon."
            actions={<PrintButton />}
          />
          <div className="flex flex-col gap-6">
            {PITCH_SECTIONS.map((section) => (
              <div key={section.heading} className="flex flex-col gap-3">
                <h2 className="text-2xl font-semibold tracking-tight">{section.heading}</h2>
                <p className="max-w-2xl text-base">{section.body}</p>
                {section.points ? (
                  <ul className="flex max-w-2xl flex-col gap-1.5">
                    {section.points.map((p) => (
                      <li key={p} className="flex items-start gap-2">
                        <span
                          aria-hidden
                          className="bg-module mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                        />
                        <p className="text-base-content text-sm">{p}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModuleProvider>
  );
}
