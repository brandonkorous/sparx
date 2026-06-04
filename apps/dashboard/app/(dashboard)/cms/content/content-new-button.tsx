'use client';

import * as React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@sparx/ui';
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
  return key === 'page' ? '/cms/new' : `/cms/types/${key}/new`;
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
        {types.map((t) => (
          <DropdownMenuItem key={t.key} asChild>
            <Link href={newHrefFor(t.key)}>{t.name}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
