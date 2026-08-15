'use client';

// The inspector — the RIGHT pane of the workflow editor. It edits whichever node
// is selected in the stage canvas, switching on the selection id:
//   • 'settings'  → the workflow header: name, reference name, and default
//   • a stage key → the full stage editor (its two names, what it means, and what
//                   happens when a document reaches it) + remove
// Only the SELECTED node's editor is shown — never all of them stacked open. Each
// view is a heading (the node's identity) over the field editors, the same fields
// the old inline stage-list expanded, hosted here for one stage at a time.
//
// This is the invoicing sibling of the automations inspector; the copy is salvaged
// verbatim from the old stage-list because it is the considered, non-technical
// wording a shop owner reads.

import {
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  Input,
  NativeSelect,
  Text,
  Button,
} from '@wizeworks/silicaui-react';
import { FileText, Trash2, Workflow, type LucideIcon } from 'lucide-react';
import type { StageDraft, WorkflowDraft } from './workflow-data';
import type { DocumentStageType } from './types';
import { STAGE_TYPES, typeHint, typeLabel } from './stage-presentation';
import { SETTINGS_NODE } from './stage-canvas';
import { productCopy } from '../../lib/product';

/** The selected node's identity: a tinted icon + title + one-line subtitle. */
function PanelHead({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="border-base-300 flex items-start gap-3 border-b pb-3">
      <span className="bg-module/10 text-module flex size-9 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col">
        <Heading level={3} className="truncate text-lg font-semibold">
          {title}
        </Heading>
        <Text className="text-sm">{subtitle}</Text>
      </div>
    </header>
  );
}

function Panel({ children }: { children?: React.ReactNode }) {
  return <div className="flex flex-col gap-4 p-3 @lg:p-4">{children}</div>;
}

export interface StageInspectorProps {
  selectedId: string;
  draft: WorkflowDraft;
  /** Name change — the editor decides whether to also carry the slug. */
  onName: (value: string) => void;
  onSlug: (value: string) => void;
  onDefault: (value: boolean) => void;
  onStagePatch: (key: string, patch: Partial<StageDraft>) => void;
  onStageRemove: (key: string) => void;
}

export function StageInspector(props: StageInspectorProps) {
  const { selectedId, draft } = props;
  if (selectedId !== SETTINGS_NODE) {
    const index = draft.stages.findIndex((stage) => stage.key === selectedId);
    if (index >= 0) {
      const stage = draft.stages[index];
      if (stage) {
        return <StagePanel {...props} stage={stage} index={index} count={draft.stages.length} />;
      }
    }
  }
  return <SettingsPanel {...props} />;
}

function SettingsPanel({ draft, onName, onSlug, onDefault }: StageInspectorProps) {
  return (
    <Panel>
      <PanelHead
        icon={Workflow}
        title="Workflow settings"
        subtitle="A workflow is the path a document takes, and who sees what along the way."
      />

      <Field>
        <FieldLabel>Name</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={draft.name}
              placeholder="Service / Repair"
              onChange={(event) => {
                onName(event.target.value);
              }}
            />
          }
        />
        <FieldDescription>How your team picks this when starting a new document.</FieldDescription>
      </Field>

      <Field>
        <FieldLabel>Reference name</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={draft.slug}
              placeholder="service-repair"
              onChange={(event) => {
                onSlug(event.target.value);
              }}
            />
          }
        />
        <FieldDescription>
          A short version with no spaces, used behind the scenes. Filled in from the name — change
          it only if you have a reason to.
        </FieldDescription>
      </Field>

      <label className="flex items-start gap-2">
        <Checkbox
          color="module"
          className="mt-1"
          checked={draft.isDefault}
          aria-label="Use this workflow by default"
          onChange={(event) => {
            onDefault(event.target.checked);
          }}
        />
        <span className="flex flex-col gap-0.5">
          <Text as="span">Use this one by default</Text>
          <Text as="span" className="text-sm">
            New documents start on this workflow unless someone picks another. Only one workflow can
            be the default — turning this on turns it off elsewhere.
          </Text>
        </span>
      </label>
    </Panel>
  );
}

function StagePanel({
  stage,
  index,
  count,
  onStagePatch,
  onStageRemove,
}: StageInspectorProps & { stage: StageDraft; index: number; count: number }) {
  const headline = stage.customerLabel.trim() || stage.name.trim() || 'Untitled stage';
  const subtitle = `${typeLabel(stage.stageType)} · stage ${String(index + 1)} of ${String(count)}`;
  const patch = (changes: Partial<StageDraft>) => {
    onStagePatch(stage.key, changes);
  };

  return (
    <Panel>
      <PanelHead icon={FileText} title={headline} subtitle={subtitle} />

      <div className="grid gap-4 @lg:grid-cols-2">
        <Field>
          <FieldLabel>What your customers see</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                value={stage.customerLabel}
                placeholder="Invoice"
                onChange={(event) => {
                  patch({ customerLabel: event.target.value });
                }}
              />
            }
          />
          <FieldDescription>
            The word printed at the top of the document at this stage — Estimate, Invoice, Work
            order, Receipt.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel>What your team calls it</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                value={stage.name}
                placeholder="Invoice"
                onChange={(event) => {
                  patch({ name: event.target.value });
                }}
              />
            }
          />
          <FieldDescription>
            {productCopy(
              'invoicing.stage.internalName',
              "Only ever shown inside Piggles. Often the same as above — make it different when your team's word for the step isn't the customer's."
            )}
          </FieldDescription>
        </Field>
      </div>

      <Field>
        <FieldLabel>What this stage means</FieldLabel>
        <NativeSelect
          color="module"
          aria-label="What this stage means"
          value={stage.stageType}
          onChange={(event) => {
            patch({ stageType: event.target.value as DocumentStageType });
          }}
        >
          {STAGE_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
        <FieldDescription>{typeHint(stage.stageType)}</FieldDescription>
      </Field>

      <div className="flex flex-col gap-3">
        <Text className="text-base font-semibold">What happens when a document gets here</Text>

        <label className="flex items-start gap-2">
          <Checkbox
            color="module"
            className="mt-1"
            checked={stage.numberOnEnter}
            aria-label="Give it a number"
            onChange={(event) => {
              patch({ numberOnEnter: event.target.checked });
            }}
          />
          <span className="flex flex-col gap-0.5">
            <Text as="span">Give it a number</Text>
            <Text as="span" className="text-sm">
              The document is stamped with the next number in sequence, once. It keeps that number
              for good.
            </Text>
          </span>
        </label>

        {stage.numberOnEnter ? (
          <Field className="ml-7 max-w-xs">
            <FieldLabel>Number prefix</FieldLabel>
            <FieldControl
              render={
                <Input
                  color="module"
                  value={stage.numberPrefix}
                  placeholder="INV-"
                  maxLength={12}
                  onChange={(event) => {
                    patch({ numberPrefix: event.target.value });
                  }}
                />
              }
            />
            <FieldDescription>
              Goes in front of the number — “INV-” gives you INV-000001. Leave it empty for plain
              numbers.
            </FieldDescription>
          </Field>
        ) : null}

        <label className="flex items-start gap-2">
          <Checkbox
            color="module"
            className="mt-1"
            checked={stage.snapshotOnEnter}
            aria-label="Freeze a permanent copy"
            onChange={(event) => {
              patch({ snapshotOnEnter: event.target.checked });
            }}
          />
          <span className="flex flex-col gap-0.5">
            <Text as="span">Freeze a permanent copy</Text>
            <Text as="span" className="text-sm">
              Saves the document exactly as it stands, forever. Later edits never change it — this
              is what you show a customer who disputes what they agreed to.
            </Text>
          </span>
        </label>

        <label className="flex items-start gap-2">
          <Checkbox
            color="module"
            className="mt-1"
            checked={stage.locksEditing}
            aria-label="Stop it being edited"
            onChange={(event) => {
              patch({ locksEditing: event.target.checked });
            }}
          />
          <span className="flex flex-col gap-0.5">
            <Text as="span">Stop it being edited</Text>
            <Text as="span" className="text-sm">
              The charges can no longer be changed. Payments can still be recorded — a locked
              invoice is exactly the one getting paid.
            </Text>
          </span>
        </label>
      </div>

      <div className="border-base-300 flex flex-col gap-2 border-t pt-4">
        <Button
          size="sm"
          variant="ghost"
          color="danger"
          className="self-start"
          onClick={() => {
            onStageRemove(stage.key);
          }}
        >
          <Trash2 className="size-4" aria-hidden />
          Remove this stage
        </Button>
        <Text className="text-sm">
          Takes it out of this workflow when you save. Documents already past this stage keep the
          number and record it gave them.
        </Text>
      </div>
    </Panel>
  );
}
