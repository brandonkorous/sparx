'use client';

// One Kanban column = one pipeline stage. The drop target is the column
// body; useDroppable wires it into the surrounding DndContext.

import { useDroppable } from '@dnd-kit/core';

import { Badge } from '@wizeworks/silicaui-react';

import { KanbanCard } from './kanban-card';
import { type KanbanDeal, type KanbanStage, stageColor } from './kanban-types';

interface KanbanColumnProps {
  stage: KanbanStage;
  deals: KanbanDeal[];
}

export function KanbanColumn({ stage, deals }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const stageValue = deals.reduce((sum, d) => sum + d.value, 0);

  return (
    <div
      ref={setNodeRef}
      className={`border-base-300 bg-base-200 w-72 shrink-0 rounded-lg border p-3 transition-colors ${
        isOver ? 'border-module bg-module/10' : ''
      }`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-row items-center justify-between">
          <div className="flex flex-row items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stageColor(stage) }} />
            <p className="text-sm font-medium">{stage.name}</p>
            <Badge color="neutral" variant="soft" size="sm">
              {deals.length}
            </Badge>
          </div>
          <p className="text-base-content text-xs">{stage.probability}%</p>
        </div>
        <p className="text-base-content text-xs">${stageValue.toLocaleString()}</p>
        <div className="flex min-h-[120px] flex-col gap-2">
          {deals.map((deal) => (
            <KanbanCard key={deal.id} deal={deal} />
          ))}
        </div>
      </div>
    </div>
  );
}
