'use client';

// The count session's toolbar — which lifecycle action is offered depends
// entirely on where the count stands, so all of that lives here rather than
// being read out of the session's JSX.

import { Badge, Button } from '@wizeworks/silicaui-react';
import {
  faClipboardCheck,
  faFloppyDisk,
  faPrint,
  faShieldCheck,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import type { CountDetail, CountState } from './counts-data';
import type { useCountActions } from './count-actions';

type Actions = ReturnType<typeof useCountActions>;

interface ToolbarProps {
  ctx: SurfaceContext;
  count: CountDetail;
  state: CountState;
  act: Actions;
  editable: boolean;
  unsaved: number;
  canFinish: boolean;
  canApprove: boolean;
  canApply: boolean;
  isFetching: boolean;
  updatedAt: number | undefined;
  onRefresh: () => void;
}

export function CountToolbar(props: ToolbarProps) {
  const { ctx, count, state, act, editable, unsaved } = props;

  return (
    <PaneToolbar
      label="Count actions"
      status={
        <Badge color={state.tone} variant="soft" size="sm">
          {state.label}
        </Badge>
      }
      primary={
        <>
          {editable ? (
            <>
              {unsaved > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto shrink-0 whitespace-nowrap"
                  loading={act.pending.enter}
                  onClick={() => {
                    void act.doSave();
                  }}
                >
                  <Icon glyph={faFloppyDisk} className="size-4" aria-hidden />
                  Save
                </Button>
              ) : null}
              <Button
                size="sm"
                color="module"
                className={`shrink-0 whitespace-nowrap${unsaved > 0 ? '' : 'ml-auto'}`}
                disabled={!props.canFinish}
                loading={act.pending.submit || act.pending.enter}
                title={
                  props.canFinish
                    ? undefined
                    : 'Enter a quantity for every item before you can finish.'
                }
                onClick={() => {
                  void act.doFinish();
                }}
              >
                <Icon glyph={faClipboardCheck} className="size-4" aria-hidden />
                Finish counting
              </Button>
            </>
          ) : null}
          {props.canApprove ? (
            <Button
              size="sm"
              color="module"
              className="ml-auto shrink-0 whitespace-nowrap"
              loading={act.pending.approve}
              onClick={() => {
                void act.doApprove();
              }}
            >
              <Icon glyph={faShieldCheck} className="size-4" aria-hidden />
              Approve
            </Button>
          ) : null}
          {props.canApply ? (
            <Button
              size="sm"
              color="module"
              className="ml-auto shrink-0 whitespace-nowrap"
              loading={act.pending.post}
              onClick={() => {
                void act.doApply();
              }}
            >
              <Icon glyph={faClipboardCheck} className="size-4" aria-hidden />
              Apply corrections
            </Button>
          ) : null}
        </>
      }
      /* The sticker that makes "scan the count sheet" true. Without it that
         instruction in Scanner mode has nothing to scan.

         A VALUE rather than bespoke `controls` JSX: `controls` is relocated into
         the narrow bar's overflow popover verbatim, so this was a bare printer
         glyph among rows that had words. */
      actions={[
        {
          label: 'Print a label',
          title: 'Print a scannable label for the count sheet',
          icon: faPrint,
          onClick: () => {
            ctx.open(
              'inventory.documents.label',
              {
                number: count.number,
                title: 'Stock count',
                subtitle: count.warehouseName ?? '',
              },
              { target: 'beside' }
            );
          },
        },
      ]}
      refresh={
        /* ALWAYS the last child of a toolbar — see RefreshButton. Picks up a
           change someone else made to this count while it sat open. */
        <RefreshButton
          isFetching={
            props.isFetching ||
            act.pending.enter ||
            act.pending.submit ||
            act.pending.post ||
            act.pending.approve
          }
          updatedAt={props.updatedAt}
          onRefresh={props.onRefresh}
        />
      }
    />
  );
}
