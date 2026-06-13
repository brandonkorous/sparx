'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { AuthFrame, ModuleProvider, type AuthFrameProps } from '@sparx/ui';

// The marketing-site origin the rail's "back" link points to (the dashboard is
// app.sparx.works; marketing is sparx.works).
const MARKETING_ORIGIN = 'https://sparx.works';

export interface AuthScreenProps {
  /** Rail headline + blurb — the value statement on the colored panel. */
  lede: AuthFrameProps['lede'];
  /** Optional rail body below the lede (e.g. <RailPoints>). */
  aside?: React.ReactNode;
  /** The form. */
  children: React.ReactNode;
}

// Shared chrome for every auth page: the indigo brand split-panel (the same
// colored rail as the onboarding wizard, via ModuleProvider="builder"), so
// sign-up flows seamlessly into setup. No marketing header — the rail owns the
// brand. Pages supply the rail value statement + the form column.
export function AuthScreen({ lede, aside, children }: AuthScreenProps) {
  return (
    <ModuleProvider module="builder">
      <AuthFrame
        lede={lede}
        aside={aside}
        asideFooter={
          <a
            href={MARKETING_ORIGIN}
            className="inline-flex items-center gap-1.5 text-white/55 transition-colors hover:text-white/90"
          >
            <span aria-hidden>←</span> Back to sparx.works
          </a>
        }
      >
        {children}
      </AuthFrame>
    </ModuleProvider>
  );
}

// White-on-rail value points for the brand panel — refined check rows.
export function RailPoints({ points }: { points: string[] }) {
  return (
    <ul className="flex flex-col gap-3.5">
      {points.map((p) => (
        <li key={p} className="flex items-start gap-3 text-[0.95rem] leading-relaxed text-white/80">
          <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15">
            <Check className="h-3 w-3 text-white" aria-hidden />
          </span>
          {p}
        </li>
      ))}
    </ul>
  );
}
