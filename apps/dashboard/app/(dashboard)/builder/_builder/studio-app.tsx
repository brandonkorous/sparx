'use client';

// StudioApp — the top of the unified builder shell (docs/builder/03 §2.7): the
// Site · Email surface switch wrapping the two sibling surfaces. The SITE surface
// is the three-zone studio (theme › layout › page on one canvas); EMAIL keeps its
// own canvas + engine (no shared chrome/Outlet), so it mounts the existing email
// editor. The switch is the only thing that lives above both — each surface brings
// its own toolbar, so this stays a thin top-level toggle.

import * as React from 'react';
import { SiteStudio, type SiteStudioProps } from './site-studio';
import { EmailBuilderApp, type EmailBuilderAppProps } from './email-builder-app';

export interface StudioAppProps {
  site: SiteStudioProps;
  /** The Email sibling surface's props, or null when no emails could be loaded
   *  (the Email tab is then disabled). */
  email: EmailBuilderAppProps | null;
}

export function StudioApp({ site, email }: StudioAppProps) {
  const [surface, setSurface] = React.useState<'site' | 'email'>('site');
  return (
    <div className="bx-studio">
      <div className="bx-surfaceswitch" role="tablist" aria-label="Builder surface">
        <button
          type="button"
          role="tab"
          aria-selected={surface === 'site'}
          className="bx-surfaceswitch__btn"
          data-on={surface === 'site'}
          onClick={() => setSurface('site')}
        >
          Site
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={surface === 'email'}
          className="bx-surfaceswitch__btn"
          data-on={surface === 'email'}
          disabled={!email}
          title={email ? 'Edit your emails' : 'No emails to edit yet'}
          onClick={() => email && setSurface('email')}
        >
          Email
        </button>
      </div>
      {surface === 'email' && email ? <EmailBuilderApp {...email} /> : <SiteStudio {...site} />}
    </div>
  );
}
