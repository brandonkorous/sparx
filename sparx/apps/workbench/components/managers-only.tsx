'use client';

// The notice on a screen somebody may read but not change, and the lock on its
// controls. One component, so every such screen says it the same way, before the
// person starts, rather than refusing on Save (sparx persona issue 168).

import type { ReactNode } from 'react';
import { Alert, AlertContent, AlertDescription, AlertTitle } from '@wizeworks/silicaui-react';

import { useManageRights } from '../lib/manage-rights';

export function ManagersOnlyNotice({
  title = 'You can see this, but not change it',
  change,
  className,
}: {
  title?: string;
  /** What only an owner or an admin can do, as a verb phrase: "change your
   *  business details". */
  change: string;
  /** Padding around it, applied only when it shows, so an owner's screen keeps
   *  no empty gap where the notice would be. */
  className?: string;
}) {
  const { known, canManage } = useManageRights();
  if (!known || canManage) return null;
  const notice = (
    <Alert color="info">
      <AlertContent>
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          Only an owner or an admin can {change}. Ask one of them if something here needs changing.
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
  // On a wrapper, not the alert: a margin on a full-width box pushes it past
  // the pane's edge.
  return className ? <div className={className}>{notice}</div> : notice;
}

/**
 * Locks every control inside for somebody who may not change it.
 *
 * A native `<fieldset disabled>` disables every input, select and button in it
 * at once, so a screen cannot lock its fields and forget one. `contents`: it
 * renders no box of its own, so wrapping a screen's cards changes nothing in how
 * they are laid out.
 */
export function ManagersOnly({ children }: { children: ReactNode }) {
  const { known, canManage } = useManageRights();
  return (
    <fieldset disabled={known && !canManage} className="contents">
      {children}
    </fieldset>
  );
}
