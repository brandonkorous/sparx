'use client';

import { type SelectionCard, type SelectionColumn, SelectionList } from '@sparx/ui';
import { Avatar, Button } from '@wizeworks/silicaui-react';
import { Pencil } from 'lucide-react';

import { EntityRowLink } from '../../../_components/entity-row-link';

// Client wrapper for the authors list (docs/34 §7). SelectionList takes render
// functions (columns/card) that can't cross the server→client boundary, so the
// server page hands serializable rows + `view` here and this builds both views.
// Read-only at the list level — `selectable={false}` (no checkboxes / bulk bar);
// the name links into the editor (EntityRowLink resolves the detail-view
// preference) and an explicit Edit action is preserved in both views.

export interface AuthorListItem {
  id: string;
  slug: string;
  display_name: string;
  bio: string | null;
  created_at: string;
}

interface AuthorsListProps {
  rows: AuthorListItem[];
  view: 'table' | 'card';
}

function formatAdded(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function AuthorsList({ rows, view }: AuthorsListProps) {
  const nameLink = (a: AuthorListItem, className: string) => (
    <EntityRowLink
      href={`/cms/authors/${a.id}`}
      entityType="author"
      entityId={a.id}
      className={className}
    >
      {a.display_name}
    </EntityRowLink>
  );

  const editButton = (a: AuthorListItem) => (
    <Button
      variant="ghost"
      size="xs"
      iconStart={<Pencil className="h-3 w-3" />}
      render={<EntityRowLink href={`/cms/authors/${a.id}`} entityType="author" entityId={a.id} />}
    >
      Edit
    </Button>
  );

  const columns: SelectionColumn<AuthorListItem>[] = [
    {
      header: 'Author',
      cell: (a) => (
        <div className="flex flex-row items-center gap-3">
          <Avatar size="sm" alt={a.display_name} />
          <div className="flex min-w-0 flex-col gap-0">
            {nameLink(a, 'truncate text-sm font-medium hover:text-module hover:underline')}
            <p className="text-base-content truncate text-xs">/{a.slug}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Bio',
      cell: (a) => <p className="text-base-content line-clamp-2 text-sm">{a.bio ?? '—'}</p>,
    },
    {
      header: 'Added',
      cell: (a) => <p className="text-base-content text-sm">{formatAdded(a.created_at)}</p>,
    },
    {
      header: '',
      id: 'actions',
      align: 'right',
      cell: (a) => <div className="flex justify-end">{editButton(a)}</div>,
    },
  ];

  const card: SelectionCard<AuthorListItem> = {
    title: (a) => (
      <div className="flex flex-row items-center gap-3">
        <Avatar size="md" alt={a.display_name} />
        <div className="flex min-w-0 flex-col gap-0">
          {nameLink(a, 'truncate text-sm font-medium hover:text-module hover:underline')}
          <p className="text-base-content truncate text-xs">/{a.slug}</p>
        </div>
      </div>
    ),
    body: (a) => (
      <div className="flex flex-col gap-2">
        {a.bio ? <p className="text-base-content line-clamp-3 text-sm">{a.bio}</p> : null}
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content text-xs">Added {formatAdded(a.created_at)}</p>
          {editButton(a)}
        </div>
      </div>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(a) => a.id}
      getRowLabel={(a) => a.display_name}
      entityLabelPlural="authors"
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
