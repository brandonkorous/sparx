'use client';

// The board dialog: make a new board, or rename, describe and share this one.

import {
  OPENS_FIRST_WORDS,
  SHARED_WORDS,
  withOpensFirst,
  withShared,
} from './dashboard-board-switches';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Switch,
  Textarea,
} from '@wizeworks/silicaui-react';

import { PaneScope } from '../../lib/dock/window-boundary';
import type { BoardDraft } from './dashboard-drafts';
import type { BoardEditing } from './use-dashboard-board';

export function BoardDialog({ editing }: { editing: BoardEditing }) {
  const { boardDraft, setBoardDraft } = editing;
  return (
    <PaneScope>
      <Dialog
        open={boardDraft !== null}
        onOpenChange={(next) => {
          if (!next) setBoardDraft(null);
        }}
      >
        <DialogContent className="flex max-h-[calc(100%-2rem)] max-w-md flex-col overflow-hidden">
          <DialogTitle>{boardDraft?.mode === 'new' ? 'A new board' : 'This board'}</DialogTitle>
          {boardDraft ? (
            <>
              <BoardForm draft={boardDraft} editing={editing} />
              <BoardDialogFooter draft={boardDraft} editing={editing} />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}

interface DraftProps {
  draft: BoardDraft;
  editing: BoardEditing;
}

function BoardForm({ draft, editing }: DraftProps) {
  const { setBoardDraft, saveBoard } = editing;
  return (
    <form
      id="crm-board-form"
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (draft.name.trim() !== '') void saveBoard(draft);
      }}
    >
      <BoardTextFields draft={draft} editing={editing} />
      <BoardSwitch
        label="Open this board first"
        description={OPENS_FIRST_WORDS}
        checked={draft.isDefault}
        onChange={(checked) => {
          setBoardDraft(withOpensFirst(draft, checked));
        }}
      />
      <BoardSwitch
        label="Share it with your team"
        description={SHARED_WORDS}
        checked={draft.shared}
        onChange={(checked) => {
          setBoardDraft(withShared(draft, checked));
        }}
      />
    </form>
  );
}

function BoardTextFields({ draft, editing }: DraftProps) {
  const { setBoardDraft } = editing;
  return (
    <>
      <Field>
        <FieldLabel>What to call it</FieldLabel>
        <Input
          color="module"
          value={draft.name}
          placeholder="Sales this month"
          onChange={(event) => {
            setBoardDraft({ ...draft, name: event.target.value });
          }}
        />
        <FieldDescription>
          Name it after the question it answers. That is what you will be looking for when there are
          four of these.
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel>What it is for</FieldLabel>
        <Textarea
          color="module"
          rows={2}
          value={draft.description}
          placeholder="The numbers we go through every Monday."
          onChange={(event) => {
            setBoardDraft({ ...draft, description: event.target.value });
          }}
        />
        <FieldDescription>Optional.</FieldDescription>
      </Field>
    </>
  );
}

interface BoardSwitchProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function BoardSwitch({ label, description, checked, onChange }: BoardSwitchProps) {
  return (
    <Field>
      <div className="flex items-start gap-3">
        <Switch
          color="module"
          aria-label={label}
          checked={checked}
          onCheckedChange={(next) => {
            onChange(next === true);
          }}
        />
        <div className="flex flex-col gap-1">
          <FieldLabel>{label}</FieldLabel>
          <FieldDescription>{description}</FieldDescription>
        </div>
      </div>
    </Field>
  );
}

function BoardDialogFooter({ draft, editing }: DraftProps) {
  return (
    <DialogFooter>
      <Button
        color="neutral"
        variant="ghost"
        size="sm"
        onClick={() => {
          editing.setBoardDraft(null);
        }}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        form="crm-board-form"
        color="module"
        size="sm"
        loading={editing.saving}
        disabled={draft.name.trim() === ''}
      >
        {draft.mode === 'new' ? 'Create it' : 'Save'}
      </Button>
    </DialogFooter>
  );
}
