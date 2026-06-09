'use client';

import * as React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sparx/ui';
import { ChevronDown, Plus } from 'lucide-react';

import { EntityCreateButton } from '../../_components/entity-create-button';

// "New" affordance for the unified content list. Two shapes:
//   - A type is active (?type=X) → a single "New <type>" button that opens in
//     the user's preferred surface via EntityCreateButton (pages get their
//     overlay create form; other entries fall back to the full-page /new route
//     since `content-entry` has no overlay create form registered).
//   - No type filter → a "New ▾" menu listing every creatable type, each
//     routing to that type's full-page create route.
//
// The page type keeps its bespoke create/edit surfaces (/cms/new, /cms/[id]);
// every other type uses the generic /cms/types/<key>/new route.

interface TypeOption {
  key: string;
  name: string;
}

interface ContentNewButtonProps {
  types: TypeOption[];
  /** The active `?type=` filter, if any. */
  activeType?: string;
}

function newHrefFor(key: string): Route {
  // Page type keeps its bespoke create/edit surface (/cms/new).
  // All other types route through the guided wizard at /cms/content/new?type=X.
  return key === 'page'
    ? '/cms/new'
    : (`/cms/content/new?type=${encodeURIComponent(key)}` as Route);
}

export function ContentNewButton({ types, activeType }: ContentNewButtonProps) {
  if (activeType) {
    const active = types.find((t) => t.key === activeType);
    const label = active ? `New ${active.name.toLowerCase()}` : 'New';
    return (
      <EntityCreateButton
        entityType={activeType === 'page' ? 'page' : 'content-entry'}
        newHref={newHrefFor(activeType)}
        color="module"
        leftIcon={<Plus className="h-4 w-4" />}
      >
        {label}
      </EntityCreateButton>
    );
  }

  // No type filter active — wizard handles type selection at step 1.
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          color="module"
          leftIcon={<Plus className="h-4 w-4" />}
          rightIcon={<ChevronDown className="h-4 w-4" />}
        >
          New
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href="/cms/content/new">Guided wizard…</Link>
        </DropdownMenuItem>
        {types.map((t) => (
          <DropdownMenuItem key={t.key} asChild>
            <Link href={newHrefFor(t.key)}>{t.name}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
