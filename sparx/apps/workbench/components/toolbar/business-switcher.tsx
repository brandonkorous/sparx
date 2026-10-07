'use client';

// Which business you are acting as.
//
// A business is a TENANT: its own customers, invoices, staff, books and
// row-level isolation. A site is one web property inside a business, and a
// business can own several. Two switchers because they answer two questions:
// "whose books am I in" and "which of their shopfronts am I editing". The
// business sits FIRST because it is the outer scope.
//
// One business, the common case, is a fact and renders as plain text. Someone
// who has joined a team holds two or more (persona issue 124), and gets a
// control.

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
import { Building2, Check, ChevronDown } from 'lucide-react';
import { useTenant } from '../../lib/api/shell-data';
import { switchBusiness, useBusinesses } from '../../lib/api/businesses';
import { useConfirm } from '../../lib/confirm';
import { deferTick } from '../../lib/defer';
import { useWorkbench } from '../../lib/workbench/context';

export function BusinessSwitcher({ siteKey }: { siteKey: string }) {
  const { controller } = useWorkbench();
  const confirm = useConfirm();
  const toast = useToast();
  const { data: businesses } = useBusinesses();
  const { data: tenant } = useTenant();

  const activeName = tenant?.name;

  if (!businesses || businesses.length <= 1) {
    return (
      <span
        data-tour="workspace"
        className="max-w-40 truncate text-sm font-medium"
        title={activeName}
      >
        {activeName ?? ' '}
      </span>
    );
  }

  const onSwitch = async (nextId: string) => {
    if (nextId === tenant?.id) return;
    // Let the menu's close commit land before opening a dialog (lib/defer.ts).
    await deferTick();
    const next = businesses.find((business) => business.id === nextId);
    const unsaved = controller.hasUnsavedWork();

    const ok = await confirm({
      title: `Switch to ${next?.name ?? 'another business'}?`,
      description: unsaved
        ? 'Something here has edits that were never saved. Switching business reloads everything and those edits are gone.'
        : 'Everything reloads for that business: its own customers, orders and invoices. What you have open here is saved and waiting when you come back.',
      confirmLabel: 'Switch business',
      cancelLabel: 'Stay here',
      color: unsaved ? 'danger' : 'primary',
    });
    if (!ok) return;

    try {
      await switchBusiness(controller, siteKey, nextId);
    } catch {
      // The server refused: almost always a membership removed since the list
      // was read. Said plainly, so nobody keeps pressing it.
      toast.add({
        title: 'Could not switch business',
        description: 'You may no longer have access to it. Nothing here has changed.',
        type: 'error',
      });
    }
  };

  return (
    <DropdownMenu>
      <Tooltip content="Switch business: each one is completely separate">
        <DropdownMenuTrigger>
          {/* Colorless: a bare ghost button resolves to `base-content` without
              naming `neutral` (RULE #4). `text-sm` keeps the toolbar at one size
              (btn-sm alone is 12px). */}
          <Button variant="ghost" size="sm" className="gap-1.5 text-sm" data-tour="workspace">
            <Building2 className="size-3.5" aria-hidden />
            <span className="max-w-44 truncate">{activeName ?? 'Business'}</span>
            <ChevronDown className="size-3" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="start">
        {/* Base UI requires a label to live inside a Group. */}
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
                {business.id === tenant?.id ? <Check className="size-4" aria-hidden /> : null}
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
