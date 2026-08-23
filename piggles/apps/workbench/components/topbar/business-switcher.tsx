'use client';

// Which business you are acting as. Split out of topbar.tsx (RULE #0.5).
//
// ── WHY THIS IS A DIFFERENT CONTROL FROM THE SITE SWITCHER ──────────────────
//
// A business is a TENANT — its own customers, invoices, staff, books and
// row-level isolation. A site is one web property inside a business, and a
// business can own several. Two switchers because they answer two questions:
// "whose books am I in" and "which of their shopfronts am I editing".
//
// Merging them would put "Copperleaf Studio" and "Copperleaf's second shop" in
// one list, where picking wrongly is either a mistake or a breach depending on
// which line you hit. The business sits FIRST because it is the outer scope.

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
  useToast,
} from '@wizeworks/silicaui-react';
import { faBuilding, faCheck, faChevronDown } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useTenant } from '@/lib/api/shell-data';
import { useConfirm } from '@/lib/confirm';
import { deferTick } from '@/lib/defer';
import { useWorkbench } from '@/lib/workbench/context';
import { switchBusiness, useBusinesses } from '@/lib/console/businesses';

export function BusinessSwitcher({
  siteKey,
  fallbackName,
}: {
  siteKey: string;
  fallbackName: string | null;
}) {
  const { controller } = useWorkbench();
  const confirm = useConfirm();
  const toast = useToast();
  const { data: businesses } = useBusinesses();
  const { data: tenant } = useTenant();

  const activeName = tenant?.name ?? fallbackName;

  // One business — the common case by far — is a FACT, not a choice. A dropdown
  // offering a single option wastes a click to say what the label already said.
  if (!businesses || businesses.length <= 1) {
    return (
      <span className="max-w-40 truncate text-sm font-medium" title={activeName ?? undefined}>
        {activeName ?? ' '}
      </span>
    );
  }

  const onSwitch = async (nextId: string) => {
    if (nextId === tenant?.id) return;
    await deferTick();
    const next = businesses.find((business) => business.id === nextId);

    const ok = await confirm({
      title: `Switch to ${next?.name ?? 'another business'}?`,
      description: controller.hasUnsavedWork()
        ? 'Something here has edits that were never saved. Switching business reloads everything and those edits are gone.'
        : 'Everything reloads for that business — its own customers, orders and invoices. What you have open here is saved and waiting when you come back.',
      confirmLabel: 'Switch business',
      cancelLabel: 'Stay here',
      color: controller.hasUnsavedWork() ? 'danger' : 'primary',
    });
    if (!ok) return;

    try {
      await switchBusiness(controller, siteKey, nextId);
    } catch {
      // Reaching here means the server refused — almost always a membership
      // revoked since the list was fetched. Said plainly, because "something
      // went wrong" would leave somebody clicking it again.
      toast.add({
        title: 'Could not switch business',
        description: 'You may no longer have access to it. Nothing here has changed.',
        type: 'error',
      });
    }
  };

  return (
    <DropdownMenu>
      <Tooltip content="Switch business — each one is completely separate">
        <DropdownMenuTrigger>
          {/* COLOURLESS: a bare `.btn` resolves to `base-content` and is
              theme-correct without naming `neutral`, which is not mine to
              choose (root RULE #4). */}
          <Button className="gap-1.5 text-sm">
            <Icon glyph={faBuilding} className="size-3.5" aria-hidden />
            <span className="max-w-44 truncate">{activeName ?? 'Business'}</span>
            <Icon glyph={faChevronDown} className="size-3" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Your businesses</DropdownMenuLabel>
          {businesses.map((business) => (
            <DropdownMenuItem
              key={business.id}
              onClick={() => {
                void onSwitch(business.id);
              }}
            >
              <span className="flex w-full items-center gap-2">
                <span className="flex-1 truncate">{business.name}</span>
                {business.id === tenant?.id ? (
                  <Icon glyph={faCheck} className="size-4" aria-hidden />
                ) : null}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>Each business keeps its own everything</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
