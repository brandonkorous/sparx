'use client';

// What you have open, as a sheet.
//
// This is the pane switcher that used to be a strip pinned under the stack. It
// is the same information and the same job; what changed is that it costs a tap
// instead of a permanent bar, which is what a phone browser does with tabs and
// what leaves room for the nav bar to exist at all.
//
// The strip could only ever show two or three chips before scrolling sideways.
// A sheet shows every pane, full width, with the app each one belongs to — so
// "which of these is the invoice" is answerable without opening them.
//
// ── Two things that sentence was promising and not doing ────────────────
//
// **Closing ONE.** Every row switched to a pane and nothing closed one. On a
// phone this sheet is the only place a pane can be closed from — the stack has
// no tab strip, and a pane's own overflow menu carries its record's actions, not
// the pane's — so the only way out of a pane was "Close everything". The other
// console's sheet has carried a per-row close from the start, and says in its
// own comment why: dropping it "would make close just this impossible on one
// column". [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// **Finding one.** "Answerable without opening them" is true of eight rows and
// false of eighty. The desktop's jump list over this exact list has had a
// search field for as long as it has existed; this had a thumb. It appears once
// the list is longer than a screenful, so the common case pays nothing for it.

import { useEffect, useState } from 'react';
import { faXmark } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Button, SearchInput } from '@wizeworks/silicaui-react';
import { getSurface } from '@/lib/surfaces/registry';
import { TabGlyph } from '@/lib/dock/tab-glyph';
import { useConfirm } from '@/lib/confirm';
import { useWorkbench } from '@/lib/workbench/context';
import type { StackPaneHost } from '@/lib/workbench/stack-host';
import { ModuleScope } from '@/components/module-scope';
import { moduleLabel } from '@/lib/surfaces/nav';
import { Sheet } from './sheet';

interface OpenSheetProps {
  open: boolean;
  host: StackPaneHost;
  order: readonly string[];
  activeId: string | null;
  onDismiss: () => void;
}

/** Open, and which one you are looking at — the same two marks the desktop
 *  panel's rows carry, so one shape means one thing in both presentations. */
function PaneMark({ focused }: { focused: boolean }) {
  return (
    <span
      aria-hidden
      className={
        focused
          ? 'bg-module size-2 shrink-0 rounded-full'
          : 'border-module size-2 shrink-0 rounded-full border-2'
      }
    />
  );
}

export function OpenSheet({ open, host, order, activeId, onDismiss }: OpenSheetProps) {
  const { controller } = useWorkbench();
  const confirm = useConfirm();
  const [query, setQuery] = useState('');

  // A filter left behind the button reads as "half my panes vanished" next
  // time. Every open starts from everything, the same rule the desktop's jump
  // list follows.
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  // Eight rows is about one thumb-screen of this sheet. Below that the field
  // would cost space to answer a question nobody has.
  const searchable = order.length > 8;
  const needle = query.trim().toLowerCase();
  const shown =
    searchable && needle
      ? order.filter((paneId) => host.titleOf(paneId).toLowerCase().includes(needle))
      : order;

  /** Asks first, then stops at the first pane somebody chose to keep — the
   *  batch contract `requestClose` documents for exactly this.
   *
   *  The desktop's "Close everything and start empty" has always confirmed and
   *  said whether anything was unsaved; the phone's did neither, so one tap
   *  closed every pane open. Same action, same question. */
  const closeEverything = async () => {
    const dirty = controller.dirtyPanes().length;
    const ok = await confirm({
      title: `Close all ${String(order.length)}?`,
      description: dirty
        ? `${dirty === 1 ? 'One of them has' : `${String(dirty)} of them have`} unsaved edits, and you will be asked about ${dirty === 1 ? 'it' : 'each one'} on the way through.`
        : 'Nothing here has unsaved edits. Your saved layouts are not affected.',
      confirmLabel: 'Close them',
      cancelLabel: 'Keep them open',
      color: 'danger',
    });
    if (!ok) return;

    for (const paneId of [...order]) {
      const closed = await controller.requestClose(paneId);
      // Kept one: the sheet stays open showing what is left, rather than
      // dismissing as though the whole thing had gone through.
      if (!closed) return;
    }
    onDismiss();
  };

  return (
    <Sheet
      open={open}
      title="Open"
      hint="tap to switch"
      onDismiss={onDismiss}
      footer={
        <Button
          block
          color="danger"
          variant="outline"
          className="min-h-13"
          onClick={() => {
            void closeEverything();
          }}
        >
          Close everything
        </Button>
      }
    >
      {searchable ? (
        <div className="px-2 pb-2">
          <SearchInput
            size="md"
            value={query}
            onValueChange={setQuery}
            aria-label="Search what you have open"
            placeholder="Search what you have open…"
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        {shown.length === 0 ? (
          <p className="px-3 py-8 text-center text-base" role="status">
            Nothing open matches that.
          </p>
        ) : null}
        {shown.map((paneId) => {
          const descriptor = controller.getDescriptor(paneId);
          const definition = descriptor ? getSurface(descriptor.surface) : undefined;
          const focused = paneId === activeId;

          return (
            <ModuleScope key={paneId} module={definition?.module ?? 'platform'}>
              <div className="flex items-center gap-1">
                <Button
                  block
                  // The one you are looking at is filled; the rest are
                  // colorless, which resolves to base-content in both themes.
                  color={focused ? 'module' : undefined}
                  variant={focused ? 'soft' : 'ghost'}
                  aria-current={focused ? 'true' : undefined}
                  className="min-h-13 justify-start gap-3 text-base"
                  onClick={() => {
                    host.show(paneId);
                    onDismiss();
                  }}
                >
                  <TabGlyph descriptor={descriptor} className="text-module size-5" />
                  <span className="min-w-0 flex-1 truncate text-start">{host.titleOf(paneId)}</span>
                  {definition ? (
                    <span className="text-sm">{moduleLabel(definition.module)}</span>
                  ) : null}
                  <PaneMark focused={focused} />
                </Button>

                {/* Closing ONE pane, which this sheet is the only place on a
                    phone to do. A full 52px target, sitting apart from the
                    switch target so a thumb aiming at one cannot land on the
                    other. Through the controller, so unsaved work still asks. */}
                <Button
                  color="danger"
                  variant="ghost"
                  shape="square"
                  className="min-h-13 min-w-13"
                  aria-label={`Close ${host.titleOf(paneId)}`}
                  onClick={() => {
                    void controller.requestClose(paneId);
                  }}
                >
                  <Icon glyph={faXmark} className="size-5" aria-hidden />
                </Button>
              </div>
            </ModuleScope>
          );
        })}
      </div>
    </Sheet>
  );
}
