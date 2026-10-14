'use client';

// The widget dialog: add a saved report to the board, or rename the card one
// already sits on. The report itself is never changed from here.

import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Select,
} from '@wizeworks/silicaui-react';

import { PaneScope } from '../../lib/dock/window-boundary';
import type { useReports } from './report-builder-data';
import type { WidgetDraft } from './dashboard-drafts';
import type { WidgetEditing } from './use-dashboard-widgets';
import { keptToItsMaker, PRIVATE_ON_SHARED_WARNING } from './report-privacy';

export type ReportList = ReturnType<typeof useReports>['data'];
type Adding = Extract<WidgetDraft, { mode: 'add' }>;
type Renaming = Extract<WidgetDraft, { mode: 'rename' }>;

export function WidgetDialog({
  editing,
  reports,
  boardShared,
}: {
  editing: WidgetEditing;
  reports: ReportList;
  /** Whether the open board is shared, so a private report on it is warned about. */
  boardShared: boolean;
}) {
  const { widgetDraft, setWidgetDraft } = editing;
  const renaming = widgetDraft?.mode === 'rename' ? widgetDraft : null;
  const adding = widgetDraft?.mode === 'add' ? widgetDraft : null;
  return (
    <PaneScope>
      <Dialog
        open={widgetDraft !== null}
        onOpenChange={(next) => {
          if (!next) setWidgetDraft(null);
        }}
      >
        <DialogContent className="flex max-h-[calc(100%-2rem)] max-w-md flex-col overflow-hidden">
          <DialogTitle>
            {renaming ? 'What this one is called' : 'Add a report to this board'}
          </DialogTitle>

          {adding ? (
            <AddWidgetForm
              adding={adding}
              editing={editing}
              reports={reports}
              boardShared={boardShared}
            />
          ) : renaming ? (
            <RenameWidgetForm renaming={renaming} editing={editing} />
          ) : null}

          <WidgetDialogFooter adding={adding} renaming={renaming} editing={editing} />
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}

interface AddWidgetFormProps {
  adding: Adding;
  editing: WidgetEditing;
  reports: ReportList;
  boardShared: boolean;
}

function AddWidgetForm({ adding, editing, reports, boardShared }: AddWidgetFormProps) {
  const { setWidgetDraft, addWidget } = editing;
  const picked = reports?.items.find((r) => r.id === adding.reportId);
  return (
    <form
      id="crm-widget-form"
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (adding.reportId !== '') void addWidget(adding.reportId, adding.title);
      }}
    >
      <ReportPickerField
        adding={adding}
        editing={editing}
        reports={reports}
        boardShared={boardShared}
      />
      {boardShared && picked && keptToItsMaker(picked) ? (
        <Alert color="warning">{PRIVATE_ON_SHARED_WARNING}</Alert>
      ) : null}

      <Field>
        <FieldLabel>Call it something else here</FieldLabel>
        <Input
          color="module"
          value={adding.title}
          placeholder="Leave empty to use the report's own name"
          onChange={(event) => {
            setWidgetDraft({ ...adding, title: event.target.value });
          }}
        />
        <FieldDescription>
          Only changes the heading on this board. The report keeps its name everywhere else.
        </FieldDescription>
      </Field>
    </form>
  );
}

function ReportPickerField({ adding, editing, reports }: AddWidgetFormProps) {
  return (
    <Field>
      <FieldLabel>Which report</FieldLabel>
      {/* No picker when there is nothing to pick: an empty Select renders as an
          invalid field, blaming the person for a state they did not cause. */}
      {(reports?.items.length ?? 0) === 0 ? (
        <FieldDescription>
          There are no reports yet. Build one under “Build a report”, or open one of the ready-made
          ones there, copy it, and change a thing.
        </FieldDescription>
      ) : (
        <Select
          color="module"
          aria-label="Which report"
          placeholder="Choose a report"
          value={adding.reportId}
          items={Object.fromEntries((reports?.items ?? []).map((r) => [r.id, r.name]))}
          onValueChange={(next) => {
            editing.setWidgetDraft({ ...adding, reportId: next as string });
          }}
        />
      )}
    </Field>
  );
}

function RenameWidgetForm({ renaming, editing }: { renaming: Renaming; editing: WidgetEditing }) {
  const { setWidgetDraft, renameWidget } = editing;
  return (
    <form
      id="crm-widget-form"
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2"
      onSubmit={(event) => {
        event.preventDefault();
        void renameWidget(renaming.widgetId, renaming.title);
      }}
    >
      <Field>
        <FieldLabel>The heading on this board</FieldLabel>
        <Input
          color="module"
          value={renaming.title}
          placeholder="Leave empty to use the report's own name"
          onChange={(event) => {
            setWidgetDraft({ ...renaming, title: event.target.value });
          }}
        />
        <FieldDescription>
          The report itself is untouched. This is what the card is called here.
        </FieldDescription>
      </Field>
    </form>
  );
}

interface FooterProps {
  adding: Adding | null;
  renaming: Renaming | null;
  editing: WidgetEditing;
}

function WidgetDialogFooter({ adding, renaming, editing }: FooterProps) {
  return (
    <DialogFooter>
      <Button
        color="neutral"
        variant="ghost"
        size="sm"
        onClick={() => {
          editing.setWidgetDraft(null);
        }}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        form="crm-widget-form"
        color="module"
        size="sm"
        loading={editing.saving}
        disabled={adding !== null && adding.reportId === ''}
      >
        {renaming ? 'Save' : 'Add it'}
      </Button>
    </DialogFooter>
  );
}
