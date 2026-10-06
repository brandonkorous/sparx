'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { useToast } from '@wizeworks/silicaui-react';
import type { Action, ConditionGroup, Trigger } from '@wizeworks/automation-schemas';
import { useActivePropertyId, useModuleStates, useSites } from '../../../lib/api/shell-data';
import { useDirtySource } from '../../../lib/workbench/dirty';
import { useConfirm } from '../../../lib/confirm';
import type { SurfaceContext } from '../../../lib/surfaces/registry';
import { SETTINGS_NODE, type NodeId } from '../automations-presentation';
import {
  useCreateAutomation,
  useDeleteAutomation,
  useDiscardDraft,
  usePublishAutomation,
  useSetAutomationStatus,
  useUpdateAutomation,
  type Automation,
} from '../automations-data';
import {
  EMPTY_FIELDS,
  docFieldsFrom,
  newActionId,
  seededFields,
  serializeDoc,
  type DocFields,
  type NewAutomationSeed,
} from './doc-fields';

const FALLBACK_MODULES = ['crm', 'email', 'commerce', 'b2b', 'cms', 'invoicing'];

function useEnabledModules() {
  const { data: moduleStates } = useModuleStates();
  const enabledModules = useMemo(
    () =>
      moduleStates ? moduleStates.filter((m) => m.enabled).map((m) => m.slug) : FALLBACK_MODULES,
    [moduleStates]
  );
  return enabledModules;
}

function useEditorMutations(automation: Automation | undefined) {
  const create = useCreateAutomation();
  const update = useUpdateAutomation(automation?.id ?? 'new');
  const scope = useUpdateAutomation(automation?.id ?? 'new');
  const publish = usePublishAutomation(automation?.id ?? 'new');
  const discard = useDiscardDraft(automation?.id ?? 'new');
  const setStatusMut = useSetAutomationStatus(automation?.id ?? 'new');
  const remove = useDeleteAutomation(automation?.id ?? 'new');
  const busy =
    create.isPending ||
    update.isPending ||
    publish.isPending ||
    discard.isPending ||
    setStatusMut.isPending ||
    remove.isPending;
  return { create, update, scope, publish, discard, setStatusMut, remove, busy };
}

function useDocState(automation: Automation | undefined, seed: NewAutomationSeed | undefined) {
  const initial = useMemo(
    () => {
      if (automation) return docFieldsFrom(automation, automation.draft ? 'draft' : 'live');
      return seed ? seededFields(seed) : EMPTY_FIELDS;
    },
    // Seed ONCE — the editor owns the doc after mount (updated from mutation
    // results), so a background refetch of the same row never churns it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [trigger, setTrigger] = useState<Trigger>(initial.trigger);
  const [conditions, setConditions] = useState<ConditionGroup>(initial.conditions);
  const [actions, setActions] = useState<Action[]>(initial.actions);
  const [actionIds, setActionIds] = useState<string[]>(() =>
    initial.actions.map(() => newActionId())
  );
  const [goal, setGoal] = useState<ConditionGroup | null>(initial.goal);
  const [maxDepth, setMaxDepth] = useState(initial.maxDepth);
  const doc = { name, description, trigger, conditions, actions, goal, maxDepth };
  const setters = { setName, setDescription, setTrigger, setConditions, setActions, setGoal };
  return { initial, ...doc, ...setters, actionIds, setActionIds, setMaxDepth };
}

function useVersionState(automation: Automation | undefined, initial: DocFields) {
  const [status, setStatus] = useState(automation?.status ?? 'draft');
  const [version, setVersion] = useState(automation?.version ?? 1);
  const [serverHasDraft, setServerHasDraft] = useState(Boolean(automation?.draft));
  const [baseline, setBaseline] = useState(() => serializeDoc(initial));
  return {
    ...{ status, setStatus, version, setVersion },
    ...{ serverHasDraft, setServerHasDraft, baseline, setBaseline },
  };
}

function useSiteScope(
  automation: Automation | undefined,
  isNew: boolean,
  defaultSite: ReturnType<typeof useActivePropertyId>
) {
  const [siteScope, setSiteScope] = useState<string | null>(
    automation ? automation.propertyId : null
  );
  const scopeSet = useRef(false);
  useEffect(() => {
    // Create defaults the scope to the site being worked in, once it resolves,
    // unless the operator has already chosen one.
    if (isNew && !scopeSet.current && defaultSite) {
      scopeSet.current = true;
      setSiteScope(defaultSite);
    }
  }, [isNew, defaultSite]);
  return { siteScope, setSiteScope, scopeSet };
}

function useEditorUi() {
  const [selectedId, setSelectedId] = useState<NodeId>(SETTINGS_NODE);
  const [mobilePane, setMobilePane] = useState<'flow' | 'edit'>('flow');
  const [showHistory, setShowHistory] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Selection ──
  const selectNode = (id: NodeId) => {
    setSelectedId(id);
    setShowHistory(false);
    setMobilePane('edit');
  };
  return {
    ...{ selectedId, setSelectedId, mobilePane, setMobilePane, showHistory, setShowHistory },
    ...{ submitted, setSubmitted, error, setError, selectNode },
  };
}

function useEditorChrome(
  ctx: SurfaceContext,
  isNew: boolean,
  name: string,
  dirty: boolean,
  create: ReturnType<typeof useCreateAutomation>
) {
  useDirtySource(
    dirty && !create.isSuccess,
    isNew
      ? 'This automation has not been created yet. Close anyway?'
      : 'This automation has unsaved changes. Close anyway?'
  );

  useEffect(() => {
    ctx.setTitle(name.trim() || (isNew ? 'New automation' : 'Automation'));
  }, [ctx, name, isNew]);
}

/** Everything the editor reads and changes (after its own useToast), in the original hook order. */
export function useEditorState(
  ctx: SurfaceContext,
  automation: Automation | undefined,
  seed: NewAutomationSeed | undefined
) {
  const isNew = !automation;
  const confirm = useConfirm();

  const { data: sites } = useSites();
  const defaultSite = useActivePropertyId();
  const enabledModules = useEnabledModules();
  const mutations = useEditorMutations(automation);

  // ── Document state (seeded once from the automation; owned locally after) ──
  const doc = useDocState(automation, seed);
  const versions = useVersionState(automation, doc.initial);
  const site = useSiteScope(automation, isNew, defaultSite);
  const ui = useEditorUi();

  const { name, description, trigger, conditions, actions, goal, maxDepth } = doc;
  const { baseline, serverHasDraft } = versions;
  const currentDoc = useMemo(
    () => serializeDoc({ name, description, trigger, conditions, actions, goal, maxDepth }),
    [name, description, trigger, conditions, actions, goal, maxDepth]
  );
  const dirty = currentDoc !== baseline;
  const hasUnpublished = dirty || serverHasDraft;
  useEditorChrome(ctx, isNew, name, dirty, mutations.create);

  return {
    ...{ ctx, automation, isNew, confirm, sites, enabledModules },
    ...{ ...mutations, ...doc, ...versions, ...site, ...ui },
    ...{ currentDoc, dirty, hasUnpublished },
  };
}

/** The state plus the toaster, which the editor holds itself: its type cannot be named here. */
export type EditorState = ReturnType<typeof useEditorState> & {
  toast: ReturnType<typeof useToast>;
};
