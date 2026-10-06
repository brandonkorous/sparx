'use client';

// What you have open, as a sheet.
//
// This is the pane switcher that used to be a strip pinned under the stack. It
// is the same information and the same job; what changed is that it costs a tap
// instead of a permanent bar, which is what a phone browser does with tabs and
// what leaves room for the nav bar to exist at all.
//
// The strip could only ever show two or three chips before scrolling sideways.
// A sheet shows every pane, full width, with the module each one belongs to — so
// "which of these is the invoice" is answerable without opening them.

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button, SearchInput } from '@wizeworks/silicaui-react';
import { getSurface } from '../../lib/surfaces/registry';
import { TabGlyph } from '../../lib/dock/tab-glyph';
import { moduleLabel } from '../../lib/surfaces/nav';
import { useWorkbench } from '../../lib/workbench/context';
import type { StackPaneHost } from '../../lib/workbench/stack-host';
import { ModuleScope } from '../module-scope';
import { Sheet } from './sheet';

interface OpenSheetProps {
  open: boolean;
  host: StackPaneHost;
  order: readonly string[];
  activeId: string | null;
  onDismiss: () => void;
}

export function OpenSheet({ open, host, order, activeId, onDismiss }: OpenSheetProps) {
  const [query, setQuery] = useState('');

  // A filter left behind the button reads as "half my panes vanished" next
  // time. Every open starts from everything, the same rule the dock's jump
  // list follows.
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  // Eight rows is about one thumb-screen of this sheet. Below that the field
  // would cost space to answer a question nobody has. The dock's jump list over
  // this exact list has had a search field for as long as it has existed; this
  // had a thumb. [[feedback_a_fix_leaves_its_neighbour_behind]]
  const searchable = order.length > 8;
  const needle = query.trim().toLowerCase();
  const shown =
    searchable && needle
      ? order.filter((paneId) => host.titleOf(paneId).toLowerCase().includes(needle))
      : order;
  const { controller } = useWorkbench();

  /** Stops at the first pane somebody chose to keep, rather than closing past
   *  it — the batch contract `requestClose` documents for exactly this. */
  const closeEverything = async () => {
    for (const paneId of [...order]) {
      const closed = await controller.requestClose(paneId);
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
                </Button>

                {/* Closing ONE pane. The strip this replaced put a × on the
                    active chip, so dropping it would make "close just this"
                    impossible on one column — the stack has no other close
                    affordance. It is a full 52px target sitting apart from the
                    switch target, which is what the strip could not afford at
                    chip size. */}
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
                  <X className="size-5" aria-hidden />
                </Button>
              </div>
            </ModuleScope>
          );
        })}
      </div>
    </Sheet>
  );
}
