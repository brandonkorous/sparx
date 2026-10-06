'use client';

// "Add what this fits" on one product: the shared chooser in a dialog. A modal
// over the pane's own work, so the pane says it is dirty while it is open.

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@wizeworks/silicaui-react';
import { faDownLeft, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneScope } from '../../lib/dock/window-boundary';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { FitmentDomain } from './products-data';
import { useFitmentChoice, type ChosenRule } from './fitment-choice';
import { FitmentChooserFields } from './fitment-chooser';

function Footer({
  saving,
  blocked,
  onCancel,
  onCommit,
}: {
  saving: boolean;
  blocked: boolean;
  onCancel: () => void;
  onCommit: () => void;
}) {
  return (
    <DialogFooter>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      <Button size="sm" color="module" loading={saving} disabled={blocked} onClick={onCommit}>
        <Icon glyph={faPlus} className="size-4" aria-hidden />
        Add it
      </Button>
    </DialogFooter>
  );
}

/** Commits through the pane; the write closes it on success, never optimistically. */
export function FitmentPicker({
  open,
  domains,
  saving,
  onClose,
  onAdd,
}: {
  open: boolean;
  domains: FitmentDomain[];
  saving: boolean;
  onClose: () => void;
  onAdd: (rule: ChosenRule) => void;
}) {
  const choice = useFitmentChoice(domains, open);
  useDirtySource(
    choice.started,
    'You were choosing something this product fits and never added it. Close anyway?'
  );
  const commit = () => {
    const rule = choice.build();
    if (rule) onAdd(rule);
  };
  const cancel = () => {
    choice.reset();
    onClose();
  };
  const blocked = choice.problem !== null;

  return (
    <PaneScope>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) cancel();
        }}
      >
        <DialogContent className="flex max-h-[calc(100%-2rem)] max-w-xl flex-col overflow-hidden">
          <DialogTitle>Add what this fits</DialogTitle>
          <div className="@container flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2 [&>*]:shrink-0">
            <FitmentChooserFields
              choice={choice}
              domains={domains}
              commit={
                <Button
                  size="sm"
                  color="module"
                  variant="soft"
                  loading={saving}
                  disabled={blocked}
                  onClick={commit}
                >
                  <Icon glyph={faDownLeft} className="size-4" aria-hidden />
                  It fits {choice.here}
                </Button>
              }
            />
          </div>
          <Footer saving={saving} blocked={blocked} onCancel={cancel} onCommit={commit} />
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}
