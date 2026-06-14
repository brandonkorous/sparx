'use client';

import type { Route } from 'next';
import { Plus } from 'lucide-react';

import { EntityCreateButton } from '../../_components/entity-create-button';

// "New" affordance for the unified content list. Honors the user's
// `defaultDetailView` (drawer / modal / full page) via EntityCreateButton:
//   - A type is active (?type=X) → "New <type>" opens that type's create
//     surface. The page type keeps its bespoke create (/cms/new + the page
//     overlay form); every other type opens the content wizard preselected to
//     that type.
//   - No type filter → "New" opens the content wizard, whose first step is the
//     type picker. `content-entry` is registered for the drawer/modal overlay,
//     so this respects the preference instead of always going full page.

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
  // Page type keeps its bespoke create/edit surface (/cms/new); all other types
  // route through the guided wizard at /cms/content/new?type=X.
  return key === 'page' ? '/cms/new' : `/cms/content/new?type=${encodeURIComponent(key)}`;
}

export function ContentNewButton({ types, activeType }: ContentNewButtonProps) {
  const active = activeType ? types.find((t) => t.key === activeType) : undefined;
  const entityType = activeType === 'page' ? 'page' : 'content-entry';
  const newHref: Route = activeType ? newHrefFor(activeType) : '/cms/content/new';
  const label = active ? `New ${active.name.toLowerCase()}` : 'New';

  return (
    <EntityCreateButton
      entityType={entityType}
      newHref={newHref}
      color="module"
      leftIcon={<Plus className="h-4 w-4" />}
    >
      {label}
    </EntityCreateButton>
  );
}
