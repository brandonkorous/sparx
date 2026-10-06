'use client';

// The markup rule pane's draft, checks and writes: save, create, remove
// (sparx persona issue 086). The pane renders what this returns.

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { useDirtySource } from '../../lib/workbench/dirty';
import { afterPaneChange } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  markupRuleErrorMessage,
  useCreateMarkupRule,
  useDeleteMarkupRule,
  useUpdateMarkupRule,
} from './markup-rules-data';
import { pricesCatalog, type MarkupRuleRow } from './markup-rule-words';
import {
  emptyRuleDraft,
  ruleDraftFrom,
  rulePayload,
  type RuleDraft,
  type SetRuleDraft,
} from './markup-rule-draft';
import { draftErrors, hasErrors } from './markup-rule-checks';
import { scopeProblem } from './markup-rule-scope';

function removeWords(rule: MarkupRuleRow): string {
  const n = rule.boundVariantCount;
  const kept =
    'Quotes and invoices already priced with it keep their prices. This cannot be undone.';
  if (n === 0) return `It will no longer be offered on quote lines. ${kept}`;
  const who = n === 1 ? '1 product is' : `${String(n)} products are`;
  return `${who} priced by this rule. They keep the price they have now and stop following their cost. ${kept}`;
}

function useRuleDraft(ctx: SurfaceContext, rule: MarkupRuleRow | undefined) {
  const saved = useMemo(() => (rule ? ruleDraftFrom(rule) : emptyRuleDraft()), [rule]);
  const [draft, setDraft] = useState<RuleDraft>(saved);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setDraft(saved);
  }, [saved, touched]);
  useEffect(() => {
    ctx.setTitle(rule ? rule.name : 'New markup rule');
  }, [ctx, rule]);
  const set: SetRuleDraft = (key, value) => {
    setTouched(true);
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const dirty = JSON.stringify(rulePayload(draft)) !== JSON.stringify(rulePayload(saved));
  return { draft, set, dirty, settle: () => setTouched(false) };
}

/** Remove the rule, after a confirm that names it and says what it touches. */
function useRemoveRule(ctx: SurfaceContext, id: string, rule: MarkupRuleRow | undefined) {
  const toast = useToast();
  const confirm = useConfirm();
  const remove = useDeleteMarkupRule(id);
  const onDelete = async () => {
    if (!rule) return;
    const ok = await confirm({
      title: `Remove ${rule.name}?`,
      description: removeWords(rule),
      confirmLabel: 'Remove this rule',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(undefined, {
      onSuccess: () => {
        ctx.close();
        afterPaneChange(() => toast.add({ title: `${rule.name} removed`, type: 'success' }));
      },
      onError: (e) => {
        const description = markupRuleErrorMessage(e, 'Nothing was changed.');
        toast.add({ title: 'Could not remove this rule', description, type: 'error' });
      },
    });
  };
  return { onDelete, removing: remove.isPending };
}

export function useMarkupRuleEditor(ctx: SurfaceContext, id: string, rule?: MarkupRuleRow) {
  const toast = useToast();
  const create = useCreateMarkupRule();
  const update = useUpdateMarkupRule(id);
  const { onDelete, removing } = useRemoveRule(ctx, id, rule);
  const { draft, set, dirty, settle } = useRuleDraft(ctx, rule);
  const [showErrors, setShowErrors] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const errors = draftErrors(draft);
  const scopeError = pricesCatalog(draft.appliesTo) ? scopeProblem(draft.scope) : null;
  useDirtySource(
    dirty && !create.isSuccess,
    rule
      ? 'This markup rule has unsaved changes. Close anyway?'
      : 'This markup rule has not been saved yet. Close anyway?'
  );

  const onCreated = (created: MarkupRuleRow) => {
    ctx.open('commerce.markup-rule.detail', { id: created.id }, { target: 'replace' });
    afterPaneChange(() => toast.add({ title: `${created.name} saved`, type: 'success' }));
  };
  const fail = (fallback: string) => (e: unknown) => {
    setFailure(markupRuleErrorMessage(e, fallback));
  };

  const submit = () => {
    if (hasErrors(errors) || scopeError) {
      setShowErrors(true);
      return;
    }
    setFailure(null);
    const payload = rulePayload(draft);
    if (!rule) {
      create.mutate(payload, { onSuccess: onCreated, onError: fail('Could not save this rule.') });
      return;
    }
    const onSuccess = () => {
      settle();
      toast.add({ title: 'Rule saved', type: 'success' });
    };
    update.mutate(payload, {
      onSuccess,
      onError: fail('Could not save this rule. Nothing was changed.'),
    });
  };

  const saving = create.isPending || update.isPending;
  return { draft, set, dirty, errors, showErrors, failure, submit, onDelete, saving, removing };
}
