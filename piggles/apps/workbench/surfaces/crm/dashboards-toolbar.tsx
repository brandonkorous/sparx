'use client';

// The dashboards pane's two toolbars: the one over a board, with its board menu,
// and the one the pane keeps in every state before there is a board.

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Text,
} from '@wizeworks/silicaui-react';
import {
  faCheck,
  faChevronDown,
  faGauge,
  faPencil,
  faPlus,
  faStar,
  faTrashCan,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { PaneToolbar } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { ActiveBoard, BoardEditing } from './use-dashboard-board';

/** The bar stays whatever state the pane is in. Until there is a board it
 *  carries what there IS: a way to make the first one, and a refresh.
 *  [[feedback_copy_the_house_layout_before_building]] */
export function BoardlessToolbar({ active, onNew }: { active: ActiveBoard; onNew: () => void }) {
  const { landing, boards } = active;
  return (
    <PaneToolbar
      label="Customer dashboards controls"
      primary={
        <Button color="module" onClick={onNew}>
          <Icon glyph={faPlus} className="size-4" aria-hidden /> Make a dashboard
        </Button>
      }
      controls={
        <RefreshButton
          isFetching={boards.isFetching}
          updatedAt={boards.data ? boards.dataUpdatedAt : undefined}
          onRefresh={() => {
            void landing.refetch();
            void boards.refetch();
          }}
        />
      }
    />
  );
}

interface BoardToolbarProps {
  active: ActiveBoard;
  editing: BoardEditing;
  onAdd: () => void;
}

export function BoardToolbar({ active, editing, onAdd }: BoardToolbarProps) {
  const { board, boards } = active;
  return (
    <PaneToolbar
      label="Customer dashboards controls"
      status={
        board?.description ? (
          <Text className="hidden min-w-0 truncate @3xl:block">{board.description}</Text>
        ) : null
      }
      // A commit action is always `primary`: `controls` relocates into the
      // overflow popover under 672px. Enforced by scripts/check-toolbar-primary.mjs.
      primary={
        <Button color="module" onClick={onAdd}>
          <Icon glyph={faPlus} className="size-4" aria-hidden /> Add a report
        </Button>
      }
      controls={<BoardMenu active={active} editing={editing} />}
      refresh={
        <RefreshButton
          isFetching={boards.isFetching}
          updatedAt={boards.data ? boards.dataUpdatedAt : undefined}
          onRefresh={() => {
            void boards.refetch();
          }}
        />
      }
    />
  );
}

/** One board cannot answer sales, support and the owner at once, so this menu
 *  is the surface for the whole set: switch, add, rename, choose which one opens
 *  first, delete. */
function BoardMenu({ active, editing }: { active: ActiveBoard; editing: BoardEditing }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button color="module" variant="soft" size="sm" className="min-w-0 gap-1.5">
          <Icon glyph={faGauge} className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{active.board?.name ?? 'Dashboards'}</span>
          <Icon glyph={faChevronDown} className="size-3 shrink-0" aria-hidden />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        <BoardMenuList active={active} />
        <DropdownMenuSeparator />
        <BoardMenuActions active={active} editing={editing} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BoardMenuList({ active }: { active: ActiveBoard }) {
  const { all, activeId, setActiveId } = active;
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Boards</DropdownMenuLabel>
      {all.map((option) => (
        <DropdownMenuItem
          key={option.id}
          onClick={() => {
            setActiveId(option.id);
          }}
        >
          <span className="flex w-full items-center gap-2">
            <span className="min-w-0 flex-1 truncate">{option.name}</span>
            {option.isDefault ? (
              <Icon glyph={faStar} className="size-3.5 shrink-0" aria-label="Opens first" />
            ) : null}
            {option.id === activeId ? (
              <Icon glyph={faCheck} className="size-4 shrink-0" aria-hidden />
            ) : null}
          </span>
        </DropdownMenuItem>
      ))}
    </DropdownMenuGroup>
  );
}

function BoardMenuActions({ active, editing }: { active: ActiveBoard; editing: BoardEditing }) {
  const { board } = active;
  return (
    <DropdownMenuGroup>
      <DropdownMenuItem onClick={editing.startNewBoard}>
        <span className="flex w-full items-center gap-2">
          <Icon glyph={faPlus} className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">Another board</span>
        </span>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={editing.startEditBoard}>
        <span className="flex w-full items-center gap-2">
          <Icon glyph={faPencil} className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">Rename or share this one</span>
        </span>
      </DropdownMenuItem>
      {board ? (
        <DropdownMenuItem
          onClick={() => {
            void editing.deleteBoard(board);
          }}
        >
          <span className="flex w-full items-center gap-2">
            <Icon glyph={faTrashCan} className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">Delete “{board.name}”</span>
          </span>
        </DropdownMenuItem>
      ) : null}
    </DropdownMenuGroup>
  );
}
