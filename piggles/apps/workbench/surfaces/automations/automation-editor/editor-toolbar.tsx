'use client';

import { Badge, Button } from '@wizeworks/silicaui-react';
import {
  faClockRotateLeft,
  faListCheck,
  faPowerOff,
  faRotateLeft,
  faTrashCan,
  faUpload,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar } from '../../../components/pane-toolbar';
import type { automationState } from '../automations-presentation';
import type { Health } from '../automation-health';
import type { EditorHandlers } from './lifecycle-handlers';
import { targetFor } from '../target-for';
import type { EditorState } from './use-editor-state';

interface ToolbarProps {
  ed: EditorState;
  h: EditorHandlers;
  state: ReturnType<typeof automationState>;
  health: Health | null;
  showDiscard: boolean;
}

function ToolbarStatus({ ed, state, health }: Omit<ToolbarProps, 'h' | 'showDiscard'>) {
  const { isNew, hasUnpublished } = ed;
  return (
    <>
      {!isNew ? (
        <Badge
          color={health ? health.tone : state.tone}
          variant="soft"
          size="sm"
          title={health ? health.inside : state.detail}
        >
          {health ? health.label : state.label}
        </Badge>
      ) : null}
      {hasUnpublished && !isNew ? (
        <Badge color="info" variant="soft" size="sm">
          Unpublished changes
        </Badge>
      ) : null}
    </>
  );
}

function ToolbarViewButtons({ ed, h }: Pick<ToolbarProps, 'ed' | 'h'>) {
  const { showHistory, setShowHistory, setMobilePane, status, setStatusMut, ctx, automation } = ed;
  const { onToggleStatus } = h;
  if (!automation) return null;
  return (
    <>
      <Button
        size="sm"
        variant={showHistory ? 'soft' : 'ghost'}
        color={showHistory ? 'module' : 'neutral'}
        className="ml-auto shrink-0"
        onClick={() => {
          setShowHistory((v) => !v);
          setMobilePane('edit');
        }}
      >
        <Icon glyph={faClockRotateLeft} className="size-4" aria-hidden />
        History
      </Button>
      <Button
        size="sm"
        variant="outline"
        color={status === 'active' ? 'neutral' : 'module'}
        className="shrink-0"
        loading={setStatusMut.isPending}
        onClick={onToggleStatus}
      >
        <Icon glyph={faPowerOff} className="size-4" aria-hidden />
        {status === 'active' ? 'Pause' : 'Turn on'}
      </Button>
      <Button
        size="sm"
        variant="outline"
        color="neutral"
        className="shrink-0"
        title="See when this rule has run"
        onClick={(event) => {
          ctx.open(
            'automations.runs',
            { automationId: automation.id },
            { target: targetFor(event) }
          );
        }}
      >
        <Icon glyph={faListCheck} className="size-4" aria-hidden />
        Runs
      </Button>
    </>
  );
}

function ToolbarDraftButtons({ ed, h, showDiscard }: Omit<ToolbarProps, 'state' | 'health'>) {
  const { discard, hasUnpublished, publish, update, dirty, busy } = ed;
  const { onDiscard, onPublish, onSave } = h;
  return (
    <>
      {showDiscard ? (
        <Button
          size="sm"
          variant="ghost"
          color="danger"
          className="shrink-0"
          loading={discard.isPending}
          onClick={() => {
            void onDiscard();
          }}
        >
          <Icon glyph={faRotateLeft} className="size-4" aria-hidden />
          Discard draft
        </Button>
      ) : null}
      {hasUnpublished ? (
        <Button
          size="sm"
          variant="outline"
          color="module"
          className="shrink-0"
          loading={publish.isPending || (update.isPending && dirty)}
          onClick={() => {
            void onPublish();
          }}
        >
          <Icon glyph={faUpload} className="size-4" aria-hidden />
          Publish
        </Button>
      ) : null}
      <Button
        size="sm"
        color="module"
        className="shrink-0"
        loading={update.isPending && !publish.isPending}
        disabled={!dirty || busy}
        onClick={onSave}
      >
        Save
      </Button>
    </>
  );
}

export function EditorToolbar({ ed, h, state, health, showDiscard }: ToolbarProps) {
  const { automation, create, busy, isNew, remove } = ed;
  const { onCreate, onDelete } = h;
  return (
    <PaneToolbar
      label="Automation actions"
      status={<ToolbarStatus ed={ed} state={state} health={health} />}
      primary={
        automation ? (
          <>
            <ToolbarViewButtons ed={ed} h={h} />
            <ToolbarDraftButtons ed={ed} h={h} showDiscard={showDiscard} />
          </>
        ) : (
          <Button
            size="sm"
            color="module"
            className="ml-auto shrink-0"
            loading={create.isPending}
            disabled={busy}
            onClick={onCreate}
          >
            Create
          </Button>
        )
      }
      /* A VALUE, not bespoke JSX: as a button this was a bare red bin, unlabelled on a
         narrow bar or folded into the overflow with no words at all.
         scripts/check-toolbar-glyph.mjs holds the line. */
      actions={
        isNew
          ? undefined
          : [
              {
                label: 'Delete',
                title: 'Delete this automation',
                icon: faTrashCan,
                tone: 'danger' as const,
                loading: remove.isPending,
                onClick: () => {
                  void onDelete();
                },
              },
            ]
      }
    />
  );
}
