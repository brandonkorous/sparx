'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@sparx/ui';

import { UnsavedGuardProvider, useLeaveGuard } from '../../../../_components/unsaved-guard';

// Guarded back-to-list link, same pattern as DetailPageShell's `DetailBackLink`
// (../../../../_components/detail-page-shell.tsx) — duplicated rather than shared
// because that component isn't exported and this frame's edge-to-edge layout
// (see the comment on the preview branch in `_content.tsx`) can't host
// DetailPageShell's own chrome.
function BackToListLink({ href, label }: { href: string; label: string }) {
  const router = useRouter();
  const runGuard = useLeaveGuard();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        void Promise.resolve(runGuard()).then((ok) => {
          if (ok) router.push(href);
        });
      }}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}

// Client shell for the content-entry editor's live-preview branch. This branch
// deliberately skips DetailPageShell for its edge-to-edge layout (see `_content.tsx`),
// which also meant it skipped DetailPageShell's `UnsavedGuardProvider` + guarded
// back-link entirely — a dirty form's edits were silently discarded by any nav
// away with no confirm, unlike every other detail surface. This restores parity.
export function PreviewEditorShell({
  listHref,
  listLabel,
  heading,
  children,
}: {
  listHref: string;
  listLabel: string;
  heading: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <UnsavedGuardProvider>
      <div className="flex h-[calc(100dvh-3rem)] min-h-0 flex-col gap-4 px-6 py-4">
        <div className="flex shrink-0 items-center gap-2">
          <BackToListLink href={listHref} label={listLabel} />
        </div>
        <div className="shrink-0">{heading}</div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </UnsavedGuardProvider>
  );
}
