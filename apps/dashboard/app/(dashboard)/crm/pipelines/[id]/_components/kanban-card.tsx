'use client';

// A single deal card on the Kanban board. Hooked into useDraggable so the
// parent DndContext can pick it up. We render a click-through link to
// /crm/deals/[id] in normal state; during drag we suppress the link via
// pointer-events so the drag doesn't accidentally navigate.
//
// The label uses EntityRowLink so plain click honours the user's default
// detail view preference (drawer / modal / full page / new tab) without
// taking the user off the Kanban board for in-flight deal review.

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Calendar } from 'lucide-react';

import { Badge } from '@wizeworks/silicaui-react';

import { EntityRowLink } from '../../../../_components/entity-row-link';
import { type KanbanDeal } from './kanban-types';

interface KanbanCardProps {
  deal: KanbanDeal;
  dragging?: boolean;
}

export function KanbanCard({ deal, dragging }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`border-base-300 bg-base-100 rounded-md border p-3 shadow-sm ${
        dragging ? 'ring-2 ring-[var(--color-module)]' : 'hover:border-module'
      }`}
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-row items-start justify-between gap-2">
          {dragging ? (
            <p className="truncate text-sm font-medium">{deal.title}</p>
          ) : (
            <EntityRowLink
              href={`/crm/deals/${deal.id}`}
              entityType="deal"
              entityId={deal.id}
              className="text-base-content hover:text-module truncate text-sm font-medium hover:underline"
              onClick={(e) => isDragging && e.preventDefault()}
            >
              {deal.title}
            </EntityRowLink>
          )}
          <p className="text-base-content text-xs tabular-nums">${deal.value.toLocaleString()}</p>
        </div>
        <div className="flex flex-row flex-wrap gap-1">
          <Badge color="neutral" variant="soft" size="sm">
            {deal.probability}%
          </Badge>
          {deal.expectedCloseDate && (
            <Badge color="neutral" variant="soft" size="sm">
              <Calendar className="h-3 w-3" />
              {new Date(deal.expectedCloseDate).toLocaleDateString()}
            </Badge>
          )}
          {deal.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} color="neutral" variant="soft" size="sm">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
