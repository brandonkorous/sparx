'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { AuthFrame, ModuleProvider, type AuthFrameProps } from '@sparx/ui';
import { SiteHeader } from '@sparx/web-chrome';

// The marketing-site origin the auth-page header links back out to. Mirrors the
// app↔marketing split (the dashboard is app.sparx.works; marketing is
// sparx.works), inverse of apps/web's APP_BASE.
const MARKETING_ORIGIN = 'https://sparx.works';

export interface AuthScreenProps {
  /** Rail headline + blurb — the value-prop on the colored panel. */
  lede: AuthFrameProps['lede'];
  /** Optional rail body below the lede (e.g. <RailPoints>). */
  aside?: React.ReactNode;
  /** The form. */
  children: React.ReactNode;
}

// Shared chrome for every auth page: the marketing <SiteHeader> on top + the
// indigo brand split-panel (the same colored rail as the onboarding wizard, via
// ModuleProvider="builder"), so sign-up flows seamlessly into setup. Pages
// supply the rail lede + value points and the form column.
export function AuthScreen({ lede, aside, children }: AuthScreenProps) {
  return (
    <ModuleProvider module="builder">
      <AuthFrame
        header={
          <SiteHeader
            marketingOrigin={MARKETING_ORIGIN}
            signInHref="/sign-in"
            signUpHref="/sign-up"
          />
        }
        lede={lede}
        aside={aside}
      >
        {children}
      </AuthFrame>
    </ModuleProvider>
  );
}

// White-on-rail value points for the brand panel.
export function RailPoints({ points }: { points: string[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {points.map((p) => (
        <li key={p} className="flex items-start gap-3 text-sm leading-relaxed text-white/85">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15">
            <Check className="h-3 w-3 text-white" aria-hidden />
          </span>
          {p}
        </li>
      ))}
    </ul>
  );
}
