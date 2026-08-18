'use client';

// Every app as a GRID, then that app's screens — the phone's two-level browse.
//
// Level two REUSES <AppPanel> rather than reimplementing it, so there is exactly
// one answer to "what is in Sell" — including its folding sections, its search
// and its quick-create — and a screen added to the platform appears on both
// presentations with no second edit.

import { useState } from 'react';
import { faChevronLeft, faGrid2Plus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Button } from '@wizeworks/silicaui-react';
import { PRODUCT } from '@piggles/config';
import type { ConsoleNavApp } from '@/lib/console/nav';
import { AllAppsDialog } from '@/components/all-apps-dialog';
import { AppPanel } from '@/components/app-panel';
import { AppGrid } from './app-grid';
import { Sheet } from './sheet';
import { useAttention } from '@/lib/console/home-data';

interface AppsSheetProps {
  open: boolean;
  nav: ConsoleNavApp[];
  onDismiss: () => void;
}

export function AppsSheet({ open, nav, onDismiss }: AppsSheetProps) {
  // null = the grid; an id = that app's screens.
  const [appId, setAppId] = useState<string | null>(null);
  const [allAppsOpen, setAllAppsOpen] = useState(false);
  const attention = useAttention();
  const entry =
    appId === null ? null : (nav.find((candidate) => candidate.app.id === appId) ?? null);

  const close = () => {
    onDismiss();
    // Back to the grid only AFTER the sheet is shut, so it does not visibly snap
    // back to level one while sliding away.
    setTimeout(() => {
      setAppId(null);
    }, 200);
  };

  return (
    <>
      <Sheet
        open={open}
        title={entry ? entry.label : `Everything ${PRODUCT.name} does`}
        onDismiss={close}
      >
        {entry ? (
          <>
            <Button
              variant="ghost"
              className="min-h-13 gap-1"
              onClick={() => {
                setAppId(null);
              }}
            >
              <Icon glyph={faChevronLeft} className="size-4" aria-hidden />
              All apps
            </Button>
            {/* Never pinned: on a phone the panel IS the sheet, and opening
                something has to dismiss it or the screen stays covered. */}
            <AppPanel
              entry={entry}
              pinned={false}
              pinnable={false}
              width="fill"
              onTogglePin={() => undefined}
              onDismiss={close}
            />
          </>
        ) : (
          <>
            <AppGrid nav={nav} attention={attention} onPick={setAppId} />

            {/* The same permanent door as the desktop rail's footer, and for the
                same reason: an app this business has put away has to stay
                visible, or onboarding's question becomes a paywall. A row rather
                than a sixteenth tile — it opens the catalogue, not an app. */}
            <Button
              block
              variant="ghost"
              className="min-h-13 justify-start gap-3 text-base"
              onClick={() => {
                setAllAppsOpen(true);
              }}
            >
              <Icon glyph={faGrid2Plus} className="size-5" aria-hidden />
              All apps
            </Button>
          </>
        )}
      </Sheet>

      <AllAppsDialog open={allAppsOpen} onOpenChange={setAllAppsOpen} />
    </>
  );
}
