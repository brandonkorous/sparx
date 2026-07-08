// Shared page scaffold for every Email surface: width-constrained container +
// the standard PageHeader (icon, title, optional description/actions). Section
// navigation now lives in the shell's contextual panel (docs/34 §11), so this
// no longer renders an in-content tab strip — each surface just renders its
// own body below the header.

import type { ReactNode } from 'react';
import { PageHeader } from '@sparx/ui';

interface EmailShellProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  /** Right-aligned header actions (e.g. a "New broadcast" button). */
  actions?: ReactNode;
  /**
   * Content width. Overview/settings/detail surfaces keep the default reading
   * column (`'wide'` → `Container size="xl"`); record-list surfaces opt into
   * `'full'` so dense tables/grids use the full viewport (docs/34 list pages).
   */
  width?: 'wide' | 'full';
  children: ReactNode;
}

export function EmailShell({
  title,
  description,
  icon,
  actions,
  width = 'wide',
  children,
}: EmailShellProps) {
  return (
    <div
      className={`mx-auto w-full px-4 sm:px-6 lg:px-8 ${
        width === 'full' ? 'max-w-none' : 'max-w-screen-xl'
      }`}
    >
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          className="mb-0"
          icon={icon}
          title={title}
          description={description}
          actions={actions}
        />
        {children}
      </div>
    </div>
  );
}
