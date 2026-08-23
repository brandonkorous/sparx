'use client';

// Which site you are editing. Split out of toolbar.tsx.
//
// Sites are workspaces here (lib/api/shell-data.ts `switchSite`), so this is
// deliberately prominent rather than buried in a settings page: it is the one
// control that changes what every pane in the window means.
//
// The workspace beside it is NOT a second switcher. A tenant is a fact of the
// session in this console, so it renders as plain identity — see the note on
// the EXCEPTIONS entry in scripts/check-console-parity.mjs, where the Piggles
// console's business switcher is argued as a product difference rather than a
// missing screen.

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { switchSite, useSites } from '../../lib/api/shell-data';
import { useConfirm } from '../../lib/confirm';
import { deferTick } from '../../lib/defer';
import { useWorkbench } from '../../lib/workbench/context';

export function SiteSwitcher({ siteKey }: { siteKey: string }) {
  const { controller } = useWorkbench();
  const confirm = useConfirm();
  const { data: sites } = useSites();

  const activeSite = sites?.find((site) => site.id === siteKey) ?? null;

  // A site switch is a full context change (per-site workspaces), so unsaved
  // work gets a real conversation first — async dialog, never window.confirm
  // (a blocking confirm inside a menu click freezes Base UI's close mid-flight).
  const onSwitchSite = async (nextSiteId: string) => {
    if (nextSiteId === siteKey) return;
    // Let the menu's close commit land before opening a dialog — lib/defer.ts.
    await deferTick();
    if (controller.hasUnsavedWork()) {
      const ok = await confirm({
        title: 'Switch sites with unsaved changes?',
        description:
          'Something here has edits that were never saved. Switching sites reloads the workbench and those edits are gone.',
        confirmLabel: 'Switch anyway',
        cancelLabel: 'Stay here',
        color: 'danger',
      });
      if (!ok) return;
    }
    await switchSite(controller, siteKey, nextSiteId);
  };

  if (!sites || sites.length === 0) return null;

  return (
    <span className="inline-flex items-center gap-1" data-tour="site-switcher">
      <span className="text-base-300 select-none" aria-hidden>
        /
      </span>
      <DropdownMenu>
        <Tooltip content="Switch site — each site keeps its own workbench layout">
          <DropdownMenuTrigger>
            {/* `text-sm` because silica bakes a font-size into every btn-<size>
                (btn-sm is 12px), which would render the site name a size smaller
                than the workspace name sitting right beside it. The toolbar
                speaks in one voice: 14px. */}
            <Button color="neutral" variant="ghost" size="sm" className="gap-1.5 text-sm">
              <Globe className="size-3.5" aria-hidden />
              <span className="max-w-44 truncate">{activeSite?.name ?? 'Site'}</span>
              <ChevronDown className="size-3" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent align="start">
          {/* Base UI requires a label to live inside a Group — a bare
              DropdownMenuLabel throws MenuGroupRootContext at runtime. */}
          <DropdownMenuGroup>
            <DropdownMenuLabel>Sites</DropdownMenuLabel>
            {sites.map((site) => (
              <DropdownMenuItem
                key={site.id}
                onClick={() => {
                  void onSwitchSite(site.id);
                }}
              >
                <span className="flex w-full items-center gap-2">
                  <span className="flex-1 truncate">{site.name}</span>
                  {site.id === siteKey ? <Check className="size-4" aria-hidden /> : null}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>Each site keeps its own pane layout</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
