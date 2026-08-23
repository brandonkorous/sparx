'use client';

// The + button — the one place in the window that makes a NEW thing without
// first finding the list it belongs in.
//
// Only surfaces VERIFIED to exist and to accept `{ id: 'new' }`. A key that does
// not resolve opens nothing and reports nothing, so a menu of guesses would read
// as a broken product rather than a missing one.
//
// The Piggles console carries the same control, and check:console-parity holds
// the two level.

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { Plus } from 'lucide-react';
import { useWorkbench } from '../../lib/workbench/context';

const QUICK_ADD: { surface: string; label: string }[] = [
  { surface: 'commerce.product.detail', label: 'A product' },
  { surface: 'invoicing.invoice.edit', label: 'An invoice' },
  { surface: 'crm.customer.detail', label: 'A customer' },
];

export function QuickAdd() {
  const { controller } = useWorkbench();
  return (
    <DropdownMenu>
      <Tooltip content="Add something">
        <DropdownMenuTrigger>
          <Button color="primary" size="sm" shape="square" aria-label="Add something">
            <Plus className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Add something</DropdownMenuLabel>
          {QUICK_ADD.map((item) => (
            <DropdownMenuItem
              key={item.surface}
              onClick={() => {
                controller.open(item.surface, { id: 'new' });
              }}
            >
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
