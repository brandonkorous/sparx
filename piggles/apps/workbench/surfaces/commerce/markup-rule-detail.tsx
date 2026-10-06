'use client';

// One markup rule, made and managed in the SAME pane: `{ id: 'new' }` builds it,
// `{ id }` manages it (sparx persona issue 086). A centred column of FormSection
// cards; removing it is a plain row after the work, under a divider.

import { Badge, Button, Heading, Text } from '@wizeworks/silicaui-react';
import { faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneWaiting } from '../../components/pane-waiting';
import { SaveFailure } from '../../components/save-failure';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useMarkupRule } from './markup-rules-data';
import { describeRule, pricesCatalog, type MarkupRuleRow } from './markup-rule-words';
import { useMarkupRuleEditor } from './use-markup-rule-editor';
import { MarkupRuleBasics } from './markup-rule-basics';
import { MarkupRulePrice } from './markup-rule-price';
import { MarkupRuleLimits } from './markup-rule-limits';
import { MarkupRuleCatalog } from './markup-rule-catalog';
import { MarkupRuleApply } from './markup-rule-apply';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4 p-4';

export function MarkupRuleDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  return id === 'new' ? <RuleEditor ctx={ctx} id="new" /> : <RuleLoader ctx={ctx} id={id} />;
}

function RuleLoader({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const query = useMarkupRule(id);
  if (query.isError) {
    return (
      <div className={PANE_SHELL}>
        <PaneLoadError
          error={query.error}
          noun="rule"
          title="Could not load this markup rule"
          description="This is a problem reaching the server. The rule itself is unaffected. Nothing has been lost."
          onRetry={() => {
            void query.refetch();
          }}
        />
      </div>
    );
  }
  if (query.isPending) {
    return (
      <div className={PANE_SHELL}>
        <PaneWaiting />
      </div>
    );
  }
  return <RuleEditor ctx={ctx} id={id} rule={query.data} />;
}

/** What this rule IS, above the form that changes it. */
function Identity({ rule }: { rule: MarkupRuleRow | undefined }) {
  return (
    <div className="flex flex-col gap-1">
      <Heading level={1} className="text-2xl font-semibold">
        {rule ? rule.name : 'Add a markup rule'}
      </Heading>
      <Text>
        {rule
          ? describeRule(rule)
          : 'Turn what something cost you into the price you charge, once, then pick the rule on a quote line instead of working each price out.'}
      </Text>
    </div>
  );
}

function RemoveRow({ busy, onRemove }: { busy: boolean; onRemove: () => void }) {
  return (
    <div className="border-base-300 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <Text className="text-sm">Remove this rule. Prices it already set stay as they are.</Text>
      <Button size="sm" variant="outline" color="danger" loading={busy} onClick={onRemove}>
        <Icon glyph={faTrashCan} className="size-4" aria-hidden />
        Remove rule
      </Button>
    </div>
  );
}

function RuleToolbar({
  rule,
  editor,
}: {
  rule: MarkupRuleRow | undefined;
  editor: ReturnType<typeof useMarkupRuleEditor>;
}) {
  return (
    <PaneToolbar
      label="Markup rule actions"
      primary={
        <Button
          color="module"
          size="sm"
          className="ml-auto"
          loading={editor.saving}
          disabled={Boolean(rule) && !editor.dirty}
          onClick={editor.submit}
        >
          {rule ? 'Save' : 'Save rule'}
        </Button>
      }
      controls={
        rule && !rule.isActive ? (
          <Badge color="warning" variant="soft" size="sm">
            Turned off
          </Badge>
        ) : null
      }
    />
  );
}

function RuleEditor({ ctx, id, rule }: { ctx: SurfaceContext; id: string; rule?: MarkupRuleRow }) {
  const editor = useMarkupRuleEditor(ctx, id, rule);
  const { draft, set, errors, showErrors } = editor;
  const sections = { draft, set, errors, showErrors };
  return (
    <div className={PANE_SHELL}>
      <RuleToolbar rule={rule} editor={editor} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <Identity rule={rule} />
          <SaveFailure title="Could not save this rule" message={editor.failure} />
          <MarkupRuleBasics draft={draft} set={set} error={showErrors ? errors.name : null} />
          <MarkupRulePrice {...sections} />
          <MarkupRuleLimits {...sections} />
          {pricesCatalog(draft.appliesTo) ? (
            <MarkupRuleCatalog
              {...sections}
              apply={rule ? <MarkupRuleApply rule={rule} dirty={editor.dirty} /> : null}
            />
          ) : null}
          {rule ? (
            <RemoveRow
              busy={editor.removing}
              onRemove={() => {
                void editor.onDelete();
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
