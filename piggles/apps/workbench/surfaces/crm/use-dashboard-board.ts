'use client';

// Which board the dashboards pane has open, and the board-level writes: make,
// rename or share, delete. Boards are plural and the operator's (docs/144 §8).

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';

import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useConfirm } from '../../lib/confirm';
import {
  useArchiveDashboard,
  useCreateDashboard,
  useDashboards,
  useDashboard,
  useLandingDashboard,
  useUpdateDashboard,
  type Dashboard,
} from './report-builder-data';
import {
  boardInput,
  deleteBoardDescription,
  editBoardDraft,
  newBoardDraft,
  type BoardDraft,
} from './dashboard-drafts';

export function useActiveBoard(ctx: SurfaceContext) {
  const paramId = typeof ctx.params.id === 'string' ? ctx.params.id : null;
  const landing = useLandingDashboard();
  const boards = useDashboards();

  // Which board is open: the one addressed, else the tenant's landing board.
  const [activeId, setActiveId] = useState<string | null>(paramId);
  const all = useMemo(() => boards.data?.items ?? [], [boards.data]);
  useEffect(() => {
    const target = landing.data;
    if (activeId || !target) return;
    // Adopt the landing board only while it is still listed: after deleting the
    // last board, a stale landing answer would reopen it on a 404.
    if (all.length === 0 || all.some((b) => b.id === target.id)) {
      setActiveId(target.id);
    }
  }, [activeId, landing.data, all]);

  const boardQuery = useDashboard(activeId ?? 'new');
  const board = boardQuery.data;
  useEffect(() => {
    ctx.setTitle(board?.name ?? 'Dashboards');
  }, [ctx, board]);

  return { landing, boards, all, activeId, setActiveId, boardQuery, board };
}

export type ActiveBoard = ReturnType<typeof useActiveBoard>;

function useDeleteBoard(active: ActiveBoard) {
  const { activeId, setActiveId, all, board } = active;
  const toast = useToast();
  const confirm = useConfirm();
  const archiveDashboard = useArchiveDashboard();

  return async function deleteBoard(target: Dashboard): Promise<void> {
    const count = target.id === activeId ? (board?.widgets ?? []).length : 0;
    const ok = await confirm({
      title: `Delete “${target.name}”?`,
      description: deleteBoardDescription(count),
      confirmLabel: 'Delete this board',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    await archiveDashboard.mutateAsync(target.id);
    // Land on whatever is left; null when it was the last one, which puts the
    // "no dashboard yet" invitation back.
    setActiveId(all.find((b) => b.id !== target.id)?.id ?? null);
    toast.add({ title: `“${target.name}” deleted`, type: 'success' });
  };
}

export function useBoardEditing(active: ActiveBoard) {
  const { activeId, setActiveId, all, board } = active;
  const toast = useToast();
  const createDashboard = useCreateDashboard();
  const updateDashboard = useUpdateDashboard(activeId ?? 'new');
  const [boardDraft, setBoardDraft] = useState<BoardDraft | null>(null);
  const deleteBoard = useDeleteBoard(active);

  async function saveBoard(draft: BoardDraft): Promise<void> {
    const input = boardInput(draft);
    if (draft.mode === 'new') {
      const created = await createDashboard.mutateAsync(input);
      setActiveId(created.id);
      setBoardDraft(null);
      toast.add({ title: `“${created.name}” created. Add a report to it.`, type: 'success' });
      return;
    }
    const saved = await updateDashboard.mutateAsync(input);
    setBoardDraft(null);
    toast.add({ title: `“${saved.name}” saved`, type: 'success' });
  }

  return {
    boardDraft,
    setBoardDraft,
    saving: createDashboard.isPending || updateDashboard.isPending,
    saveBoard,
    deleteBoard,
    startNewBoard: (): void => {
      setBoardDraft(newBoardDraft(all.length));
    },
    startEditBoard: (): void => {
      if (!board) return;
      setBoardDraft(editBoardDraft(board));
    },
  };
}

export type BoardEditing = ReturnType<typeof useBoardEditing>;
