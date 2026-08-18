'use client';

// Every module as a GRID, then that module's surfaces — the phone's two-level
// browse.
//
// The desktop rail and module panel are two columns you read at once. On one
// column the same information becomes a drill-down, and it arrives from the
// bottom rather than the side: the bar that opens it is at the bottom, and a
// sheet that appears where the thumb already is costs no reach.
//
// Level two REUSES <ModulePanel> rather than reimplementing it, so there is
// exactly one answer to "what is in Selling" — including its filter, its section
// headings and its quick-create — and a surface added to the catalog appears on
// both presentations with no second edit.

import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@wizeworks/silicaui-react';
import { useVisibleNav } from '../../lib/surfaces/use-visible-nav';
import { moduleLabel } from '../../lib/surfaces/nav';
import { ModulePanel } from '../module-panel';
import type { WorkbenchModule } from '../module-scope';
import { ModuleGrid } from './module-grid';
import { Sheet } from './sheet';

interface ModulesSheetProps {
  open: boolean;
  onDismiss: () => void;
}

export function ModulesSheet({ open, onDismiss }: ModulesSheetProps) {
  const nav = useVisibleNav();
  // null = the grid; a module = that module's surfaces.
  const [module, setModule] = useState<WorkbenchModule | null>(null);

  const close = () => {
    onDismiss();
    // Back to the grid only AFTER the sheet is shut, so it does not visibly snap
    // back to level one while sliding away.
    setTimeout(() => {
      setModule(null);
    }, 200);
  };

  return (
    <Sheet
      open={open}
      title={module ? moduleLabel(module) : 'Everything sparx does'}
      onDismiss={close}
    >
      {module ? (
        <>
          <Button
            variant="ghost"
            className="min-h-13 gap-1"
            onClick={() => {
              setModule(null);
            }}
          >
            <ChevronLeft className="size-4" aria-hidden />
            All modules
          </Button>
          {/* Never pinned: on a phone the panel IS the sheet, and opening
              something has to dismiss it or the screen stays covered. */}
          <ModulePanel
            module={module}
            pinned={false}
            pinnable={false}
            width="fill"
            onTogglePin={() => undefined}
            onDismiss={close}
          />
        </>
      ) : (
        <ModuleGrid nav={nav} onPick={setModule} />
      )}
    </Sheet>
  );
}
