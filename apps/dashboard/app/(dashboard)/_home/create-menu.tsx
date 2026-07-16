'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Bot,
  Building2,
  ChevronDown,
  FileText,
  Mail,
  Plus,
  ShoppingBag,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@wizeworks/silicaui-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@sparx/ui';

// The "Create" quick-action menu, pinned to the header where a quick action
// belongs (not the page footer). One primary button opens a module-gated menu
// of create routes, each with its module hue — richer than a row of buttons and
// it scales as modules turn on without cluttering the screen.

interface CreateAction {
  module: string;
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}

const ACTIONS: CreateAction[] = [
  {
    module: 'commerce',
    href: '/commerce/products/new',
    label: 'Product',
    hint: 'Add to your catalog',
    icon: ShoppingBag,
  },
  {
    module: 'cms',
    href: '/cms/content/new',
    label: 'Content',
    hint: 'Page or blog post',
    icon: FileText,
  },
  {
    module: 'crm',
    href: '/crm/customers/new',
    label: 'Customer',
    hint: 'New contact',
    icon: UserPlus,
  },
  {
    module: 'email',
    href: '/email/broadcasts/new',
    label: 'Broadcast',
    hint: 'Send a campaign',
    icon: Mail,
  },
  {
    module: 'b2b',
    href: '/b2b/accounts/new',
    label: 'B2B account',
    hint: 'Wholesale buyer',
    icon: Building2,
  },
  {
    module: 'automations',
    href: '/automations/new',
    label: 'Automation',
    hint: 'Automate a workflow',
    icon: Bot,
  },
];

export function CreateMenu({ modules }: { modules: ReadonlySet<string> }) {
  const actions = ACTIONS.filter((a) => modules.has(a.module));
  if (actions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          color="primary"
          iconStart={<Plus className="h-4 w-4" />}
          iconEnd={<ChevronDown className="h-4 w-4" />}
        >
          Create
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Create new</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {actions.map((a) => (
          <DropdownMenuItem key={a.href} asChild>
            <Link href={a.href} className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                style={{
                  color: `var(--color-module-${a.module})`,
                  background: `color-mix(in oklab, var(--color-module-${a.module}) 14%, var(--color-base-100))`,
                }}
              >
                <a.icon className="h-4 w-4" />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-medium">{a.label}</span>
                <span className="text-base-content text-xs">{a.hint}</span>
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
