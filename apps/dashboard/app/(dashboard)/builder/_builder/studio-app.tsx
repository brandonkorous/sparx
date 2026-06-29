'use client';

// StudioApp — the top of the unified builder shell (docs/builder/03 §2.7): the
// two-zone SITE studio (layout › page on one live canvas; brand & theme are their
// own surface, /builder/brand). Email is a different medium (its own canvas/engine,
// no shared chrome/Outlet) and lives on its own route, /builder/email, reached from
// the sidebar — it is NOT a surface of this studio. Keeping the two apart means the
// site editor never has to special-case the email medium, and each is maintained
// where it belongs.

import { SiteStudio, type SiteStudioProps } from './site-studio';

export interface StudioAppProps {
  site: SiteStudioProps;
}

export function StudioApp({ site }: StudioAppProps) {
  return (
    <div className="bx-studio">
      <SiteStudio {...site} />
    </div>
  );
}
