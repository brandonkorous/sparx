'use client';

// One markup rule: make it, then manage it, as the SAME pane (`{ id: 'new' }`
// builds it, `{ id }` manages it). Sparx persona issue 086: the quote line
// editor offered rules that no screen could make or change.
//
// One centred column of FormSection cards, the house editor layout: what the
// rule is, how it works a price out (with what a $100 cost comes to), optional
// limits, and, for a rule that prices the catalog, how it is applied there.
// Removing it is a plain row after the work, under a divider.

import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Heading,
  Input,
  Select,
  Switch,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { Trash2 } from 'lucide-react';
import { useConfirm } from '../../lib/confirm';
import { useDirtySource } from '../../lib/workbench/dirty';
import { afterPaneChange } from '../../lib/defer';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { FormSection } from '../../components/form-section';
import { PaneLoadError } from '../../components/pane-load-error';
import { SaveFailure } from '../../components/save-failure';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  markupRuleErrorMessage,
  useCreateMarkupRule,
  useDeleteMarkupRule,
  useMarkupRule,
  useUpdateMarkupRule,
} from './markup-rules-data';
import {
  APPLIES_TO_WORDS,
  describeRule,
  draftErrors,
  emptyRuleDraft,
  hasErrors,
  pricesCatalog,
  ruleDraftFrom,
  rulePayload,
  type AppliesTo,
  type MarkupRuleRow,
  type RuleDraft,
  type SetRuleDraft,
} from './markup-rule-words';
import { MarkupRulePrice } from './markup-rule-price';
import { MarkupRuleLimits } from './markup-rule-limits';
import { MarkupRuleCatalog, scopeProblem } from './markup-rule-catalog';
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
        <p className="p-4 text-sm" role="status">
          Loading…
        </p>
      </div>
    );
  }
  return <RuleEditor ctx={ctx} id={id} rule={query.data} />;
}

function RuleEditor({ ctx, id, rule }: { ctx: SurfaceContext; id: string; rule?: MarkupRuleRow }) {
  const isNew = id === 'new';
  const toast = useToast();
  const confirm = useConfirm();
  const create = useCreateMarkupRule();
  const update = useUpdateMarkupRule(id);
  const remove = useDeleteMarkupRule(id);

  const saved = useMemo(() => (rule ? ruleDraftFrom(rule) : emptyRuleDraft()), [rule]);
  const [draft, setDraft] = useState<RuleDraft>(saved);
  const [touched, setTouched] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    if (!touched) setDraft(saved);
  }, [saved, touched]);

  useEffect(() => {
    ctx.setTitle(isNew ? 'New markup rule' : (rule?.name ?? 'Markup rule'));
  }, [ctx, isNew, rule]);

  const set: SetRuleDraft = (key, value) => {
    setTouched(true);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const errors = draftErrors(draft);
  const scopeError = pricesCatalog(draft.appliesTo) ? scopeProblem(draft.scope) : null;
  const blocked = hasErrors(errors) || scopeError !== null;
  const dirty = JSON.stringify(rulePayload(draft)) !== JSON.stringify(rulePayload(saved));

  useDirtySource(
    dirty && !create.isSuccess,
    isNew
      ? 'This markup rule has not been saved yet. Close anyway?'
      : 'This markup rule has unsaved changes. Close anyway?'
  );

  const submit = () => {
    if (blocked) {
      setShowErrors(true);
      return;
    }
    setFailure(null);
    const payload = rulePayload(draft);
    if (isNew) {
      create.mutate(payload, {
        onSuccess: (created) => {
          ctx.open('commerce.markup-rule.detail', { id: created.id }, { target: 'replace' });
          afterPaneChange(() => {
            toast.add({ title: `${created.name} saved`, type: 'success' });
          });
        },
        onError: (error) => {
          setFailure(markupRuleErrorMessage(error, 'Could not save this rule.'));
        },
      });
      return;
    }
    update.mutate(payload, {
      onSuccess: () => {
        setTouched(false);
        toast.add({ title: 'Rule saved', type: 'success' });
      },
      onError: (error) => {
        setFailure(markupRuleErrorMessage(error, 'Could not save this rule. Nothing was changed.'));
      },
    });
  };

  const onDelete = async () => {
    if (!rule) return;
    const bound = rule.boundVariantCount;
    const ok = await confirm({
      title: `Remove ${rule.name}?`,
      description:
        bound > 0
          ? `${bound === 1 ? '1 product is' : `${String(bound)} products are`} priced by this rule. They keep the price they have now and stop following their cost. Quotes and invoices already priced with it keep their prices. This cannot be undone.`
          : 'It will no longer be offered on quote lines. Quotes and invoices already priced with it keep their prices. This cannot be undone.',
      confirmLabel: 'Remove this rule',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(undefined, {
      onSuccess: () => {
        ctx.close();
        afterPaneChange(() => {
          toast.add({ title: `${rule.name} removed`, type: 'success' });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not remove this rule',
          description: markupRuleErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Markup rule actions"
        primary={
          <Button
            color="module"
            size="sm"
            className="ml-auto"
            loading={create.isPending || update.isPending}
            disabled={!isNew && !dirty}
            onClick={submit}
          >
            {isNew ? 'Save rule' : 'Save'}
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

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {/* Identity: what this rule IS, in a sentence, above the form that
              changes it. A new one says what a rule is for. */}
          <div className="flex flex-col gap-1">
            <Heading level={1} className="text-2xl font-semibold">
              {isNew ? 'Add a markup rule' : (rule?.name ?? 'Markup rule')}
            </Heading>
            <Text>
              {rule
                ? describeRule(rule)
                : 'Turn what something cost you into the price you charge, once, then pick the rule on a quote line instead of working each price out.'}
            </Text>
          </div>

          <SaveFailure title="Could not save this rule" message={failure} />

          <RuleBasics draft={draft} set={set} error={showErrors ? errors.name : null} />
          <MarkupRulePrice draft={draft} set={set} errors={errors} showErrors={showErrors} />
          <MarkupRuleLimits draft={draft} set={set} errors={errors} showErrors={showErrors} />
          {pricesCatalog(draft.appliesTo) ? (
            <MarkupRuleCatalog
              draft={draft}
              set={set}
              errors={errors}
              showErrors={showErrors}
              apply={rule ? <MarkupRuleApply rule={rule} dirty={dirty} /> : null}
            />
          ) : null}

          {rule ? (
            <div className="border-base-300 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <Text className="text-sm">
                Remove this rule. Prices it already set stay as they are.
              </Text>
              <Button
                size="sm"
                variant="outline"
                color="danger"
                loading={remove.isPending}
                onClick={() => {
                  void onDelete();
                }}
              >
                <Trash2 className="size-4" aria-hidden />
                Remove rule
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RuleBasics({
  draft,
  set,
  error,
}: {
  draft: RuleDraft;
  set: SetRuleDraft;
  error: string | null;
}) {
  return (
    <FormSection title="The rule">
      <Field>
        <FieldLabel>Name</FieldLabel>
        <FieldControl
          render={
            <Input
              color={error ? 'error' : 'module'}
              value={draft.name}
              placeholder="Parts plus 40%"
              onChange={(event) => {
                set('name', event.target.value);
              }}
            />
          }
        />
        {error ? (
          <FieldStatus status="error">{error}</FieldStatus>
        ) : (
          <FieldDescription>What you will pick it by on a quote line.</FieldDescription>
        )}
      </Field>

      <Field>
        <FieldLabel>What it prices</FieldLabel>
        <FieldControl
          render={
            <div className="max-w-sm">
              <Select
                color="module"
                aria-label="What this rule prices"
                value={draft.appliesTo}
                items={(Object.keys(APPLIES_TO_WORDS) as AppliesTo[]).map((value) => ({
                  value,
                  label: APPLIES_TO_WORDS[value],
                }))}
                onValueChange={(next) => {
                  if (next) set('appliesTo', next as AppliesTo);
                }}
              />
            </div>
          }
        />
        <FieldDescription>
          Quote and invoice lines offer it when you price a line. The catalog uses it to set the
          prices on your products.
        </FieldDescription>
      </Field>

      <Field>
        <div className="flex items-start gap-3">
          <Switch
            color="module"
            aria-label="In use"
            checked={draft.isActive}
            onCheckedChange={(checked) => {
              set('isActive', checked === true);
            }}
          />
          <div className="flex flex-col gap-1">
            <FieldLabel>In use</FieldLabel>
            <FieldDescription>
              Turned off, it is not offered on quote lines and stops repricing products when their
              cost changes.
            </FieldDescription>
          </div>
        </div>
      </Field>
    </FormSection>
  );
}
