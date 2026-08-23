'use client';

// Which of this business's sites you are editing. Split out of topbar.tsx
// (RULE #0.5). Sits after the business, because the site list only means
// anything once the business is known.

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
import { faCheck, faChevronDown, faGlobe } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { switchSite, useSites } from '@/lib/api/shell-data';
import { useConfirm } from '@/lib/confirm';
import { deferTick } from '@/lib/defer';
import { useWorkbench } from '@/lib/workbench/context';

export function SiteSwitcher({ siteKey }: { siteKey: string }) {
  const { controller } = useWorkbench();
  const confirm = useConfirm();
  const { data: sites } = useSites();

  const activeSite = sites?.find((site) => site.id === siteKey) ?? null;

  // A site switch is a full context change (layouts are per-site), so unsaved
  // work gets a real conversation first — an async dialog, never
  // `window.confirm`, which blocks inside a Base UI menu's close and freezes it
  // mid-flight.
  const onSwitchSite = async (nextSiteId: string) => {
    if (nextSiteId === siteKey) return;
    await deferTick();
    if (controller.hasUnsavedWork()) {
      const ok = await confirm({
        title: 'Switch sites with unsaved changes?',
        description:
          'Something here has edits that were never saved. Switching sites reloads the page and those edits are gone.',
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
    <span className="inline-flex items-center gap-1">
      <span className="text-base-300 select-none" aria-hidden>
        /
      </span>
      <DropdownMenu>
        <Tooltip content="Switch site — each one keeps its own arrangement">
          <DropdownMenuTrigger>
            {/* `text-sm` because silica bakes a font-size into every btn-<size>
                (btn-sm is 12px), which would render the site name a size smaller
                than the business name beside it. The bar speaks in one voice. */}
            <Button variant="ghost" className="gap-1.5 text-sm">
              <Icon glyph={faGlobe} className="size-3.5" aria-hidden />
              <span className="max-w-44 truncate">{activeSite?.name ?? 'Site'}</span>
              <Icon glyph={faChevronDown} className="size-3" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent align="start">
          {/* Base UI requires a label to live inside a Group — a bare
              DropdownMenuLabel throws MenuGroupRootContext at runtime. */}
          <DropdownMenuGroup>
            <DropdownMenuLabel>Your sites</DropdownMenuLabel>
            {sites.map((site) => (
              <DropdownMenuItem
                key={site.id}
                onClick={() => {
                  void onSwitchSite(site.id);
                }}
              >
                <span className="flex w-full items-center gap-2">
                  <span className="flex-1 truncate">{site.name}</span>
                  {site.id === siteKey ? (
                    <Icon glyph={faCheck} className="size-4" aria-hidden />
                  ) : null}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>Each site keeps its own arrangement</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
