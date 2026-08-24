'use client';

// The two panes: a stage canvas on the left drawing the workflow as a vertical
// pipeline, an inspector on the right editing whichever node is selected. On a
// narrow pane they stack and a Flow/Properties switch flips between them.

import { Button } from '@wizeworks/silicaui-react';
import { StageCanvas } from './stage-canvas';
import { StageInspector } from './stage-inspector';
import type { StageOps } from './workflow-editor-stages';
import type { WorkflowDraft } from './workflow-data';

// The stage map is the gray canvas the cards sit ON (base-200); the inspector to
// its right is the raised working surface (base-100).
const flowPane = 'bg-base-200 min-h-0 overflow-y-auto';
const paneCard = 'card bg-base-100 min-h-0 overflow-y-auto';

export function WorkflowPanes({
  draft,
  stageOps,
  onName,
  onSlug,
  onDefault,
}: {
  draft: WorkflowDraft;
  stageOps: StageOps;
  onName: (value: string) => void;
  onSlug: (value: string) => void;
  onDefault: (value: boolean) => void;
}) {
  return (
    <>
      {/* Narrow-pane switch — hidden once the two panes fit side by side. */}
      <div className="flex shrink-0 gap-1 @3xl:hidden">
        {(['flow', 'edit'] as const).map((pane) => (
          <Button
            key={pane}
            size="sm"
            variant={stageOps.pane === pane ? 'soft' : 'ghost'}
            color={stageOps.pane === pane ? 'module' : undefined}
            onClick={() => {
              stageOps.setPane(pane);
            }}
          >
            {pane === 'flow' ? 'Flow' : 'Properties'}
          </Button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 @3xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className={`${stageOps.pane === 'flow' ? 'block' : 'hidden'} @3xl:block ${flowPane}`}>
          <StageCanvas
            name={draft.name}
            slug={draft.slug}
            isDefault={draft.isDefault}
            stages={draft.stages}
            selectedId={stageOps.selectedId}
            onSelect={stageOps.select}
            onInsertStage={stageOps.insert}
            onMoveStage={stageOps.move}
          />
        </div>

        <aside
          className={`${stageOps.pane === 'edit' ? 'block' : 'hidden'} @3xl:block ${paneCard}`}
        >
          <StageInspector
            selectedId={stageOps.selectedId}
            draft={draft}
            onName={onName}
            onSlug={onSlug}
            onDefault={onDefault}
            onStagePatch={stageOps.patch}
            onStageRemove={stageOps.remove}
          />
        </aside>
      </div>
    </>
  );
}
