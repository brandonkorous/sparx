'use client';

// The + button. Split out of topbar.tsx (RULE #0.5).

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
import { faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useWorkbench } from '@/lib/workbench/context';

// Only surfaces VERIFIED to exist and to accept `{ id: 'new' }` — a key that
// does not resolve opens nothing and reports nothing, so a menu of guesses
// would read as a broken product rather than a missing one.
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
          <Button color="primary" shape="square" aria-label="Add something">
            <Icon glyph={faPlus} className="size-4" aria-hidden />
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
