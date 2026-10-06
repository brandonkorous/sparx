'use client';

import { Button } from '@wizeworks/silicaui-react';
import { FlowCanvas } from '../flow-canvas';
import { Inspector } from '../inspector';
import { HistoryPanel } from '../history-panel';
import type { EditorHandlers } from './lifecycle-handlers';
import type { EditorState } from './use-editor-state';

interface PaneProps {
  ed: EditorState;
  h: EditorHandlers;
}

// The flow map is the gray canvas the step cards sit ON (base-200); the
// inspector to its right is the raised working surface (base-100). Matches the
// dashboard's two-tone map + inspector split.
const flowPane = 'bg-base-200 min-h-0 overflow-y-auto';
const paneCard = 'card bg-base-100 min-h-0 overflow-y-auto';

/* Narrow-pane switch — hidden once the two panes fit side by side. */
export function PaneSwitch({ ed }: { ed: EditorState }) {
  const { mobilePane, setMobilePane, showHistory } = ed;
  return (
    <div className="flex shrink-0 gap-1 @3xl:hidden">
      {(['flow', 'edit'] as const).map((p) => (
        <Button
          key={p}
          size="sm"
          variant={mobilePane === p ? 'soft' : 'ghost'}
          color={mobilePane === p ? 'module' : 'neutral'}
          onClick={() => {
            setMobilePane(p);
          }}
        >
          {p === 'flow' ? 'Flow' : showHistory ? 'History' : 'Properties'}
        </Button>
      ))}
    </div>
  );
}

function PropertiesPane({ ed, h }: PaneProps) {
  const { showHistory, automation, version, dirty, selectedId, enabledModules, isNew } = ed;
  const { name, setName, submitted, description, setDescription, maxDepth, setMaxDepth } = ed;
  const { siteScope, sites, trigger, setTrigger, conditions, setConditions } = ed;
  const { actions, actionIds, goal, setGoal } = ed;
  const { onRestored, onSiteScope, updateAction, removeAction, actionForNode } = h;
  const { setBranchQuestion } = h;
  return showHistory && automation ? (
    <div className="p-3 @lg:p-4">
      <HistoryPanel
        id={automation.id}
        liveVersion={version}
        dirty={dirty}
        onRestored={onRestored}
      />
    </div>
  ) : (
    <Inspector
      selectedId={selectedId}
      enabledModules={enabledModules}
      isNew={isNew}
      name={name}
      onName={setName}
      nameError={name.trim() === '' ? 'Give this automation a name.' : null}
      touched={submitted}
      description={description}
      onDescription={setDescription}
      maxDepth={maxDepth}
      onMaxDepth={setMaxDepth}
      siteScope={siteScope}
      onSiteScope={onSiteScope}
      sites={sites ?? []}
      trigger={trigger}
      onTrigger={setTrigger}
      conditions={conditions}
      onConditions={setConditions}
      actions={actions}
      actionIds={actionIds}
      onAction={updateAction}
      onRemoveAction={removeAction}
      goal={goal}
      onGoal={setGoal}
      actionForNode={actionForNode}
      onBranchQuestion={setBranchQuestion}
    />
  );
}

export function EditorPanes({ ed, h }: PaneProps) {
  const { mobilePane, name, status, maxDepth, trigger, conditions, actions, goal } = ed;
  const { actionIds, selectedId, selectNode } = ed;
  const { insertAction, moveAction, insertIntoArm } = h;
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 @3xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className={`${mobilePane === 'flow' ? 'block' : 'hidden'} @3xl:block ${flowPane}`}>
        <FlowCanvas
          name={name}
          status={status}
          maxDepth={maxDepth}
          trigger={trigger}
          conditions={conditions}
          actions={actions}
          goal={goal}
          actionIds={actionIds}
          selectedId={selectedId}
          onSelect={selectNode}
          onInsertAction={insertAction}
          onMoveAction={moveAction}
          onInsertIntoArm={insertIntoArm}
        />
      </div>

      <aside className={`${mobilePane === 'edit' ? 'block' : 'hidden'} @3xl:block ${paneCard}`}>
        <PropertiesPane ed={ed} h={h} />
      </aside>
    </div>
  );
}
