'use client';

// The four things a person can do to a design on ONE chosen site — add it,
// publish it, update it, remove it. Each is a confirm that names the site, then a
// mutation, then a sentence about what happened.
//
// Split out of the pane so the pane is layout and this is consequence.

import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { afterPaneChange } from '../../lib/defer';
import {
  useGoLiveInstall,
  useInstallBlueprint,
  useUninstallInstall,
  type Blueprint,
  type BlueprintInstall,
} from './blueprints-data';
import { useUpdateInstall, type UpdatePlan } from './blueprints-update';
import { blueprintErrorMessage, examplesSentence } from './blueprints-words';

export interface ActionsInput {
  blueprint: Blueprint;
  /** The site every action targets. Empty until the sites list loads. */
  targetSite: string;
  targetName: string;
  /** This blueprint's install in the chosen site, if it has one. */
  current: BlueprintInstall | undefined;
  plan: UpdatePlan | undefined;
  refetchInstalls: () => void;
}

/** What is changing, in plain words, for the update confirm. */
function changeLine(plan: UpdatePlan | undefined): string {
  const s = plan?.summary;
  if (!s) return '';
  const bits: string[] = [];
  if (s.new > 0) bits.push(`${String(s.new)} new ${s.new === 1 ? 'addition' : 'additions'}`);
  if (s.updated > 0) bits.push(`${String(s.updated)} update${s.updated === 1 ? '' : 's'}`);
  if (s.conflicts > 0) bits.push(`${String(s.conflicts)} you've edited (your version is kept)`);
  return bits.length > 0 ? ` This brings in ${bits.join(', ')}.` : '';
}

export function useBlueprintActions(input: ActionsInput) {
  const { blueprint, targetSite, targetName, current, plan, refetchInstalls } = input;
  const toast = useToast();
  const confirm = useConfirm();

  const install = useInstallBlueprint(blueprint.key);
  const goLive = useGoLiveInstall();
  const uninstall = useUninstallInstall();
  const update = useUpdateInstall();

  const failed = (title: string) => (error: unknown) => {
    toast.add({
      title,
      description: blueprintErrorMessage(error, 'Nothing was changed.'),
      type: 'error',
    });
  };

  const onInstall = async (sampleData: boolean) => {
    if (targetSite === '') return;
    const ok = await confirm({
      title: `Add “${blueprint.name}” to ${targetName}?`,
      description: `This adds the design's pages and a matching look to ${targetName} — all as drafts only you can see. ${examplesSentence(sampleData)} Your existing pages and products are left exactly as they are, and nothing goes live until you publish it.`,
      confirmLabel: 'Add it',
      cancelLabel: 'Cancel',
      color: 'module',
    });
    if (!ok) return;
    install.mutate(
      { propertyId: targetSite, sampleData },
      {
        onSuccess: () => {
          refetchInstalls();
          afterPaneChange(() => {
            toast.add({
              title: `${blueprint.name} added to ${targetName}`,
              description:
                'It is on your site as drafts. Review it, then publish it when you are ready.',
              type: 'success',
            });
          });
        },
        onError: failed('Could not add this design'),
      }
    );
  };

  const onGoLive = async () => {
    if (!current) return;
    const ok = await confirm({
      title: `Publish “${blueprint.name}” on ${targetName}?`,
      description: `This makes everything the design added — its pages, look, and anything else it created — live on ${targetName} for visitors to see. You can still edit any of it afterwards.`,
      confirmLabel: 'Publish it live',
      cancelLabel: 'Not yet',
      color: 'module',
    });
    if (!ok) return;
    goLive.mutate(current.id, {
      onSuccess: () => {
        refetchInstalls();
        toast.add({ title: `${blueprint.name} is live on ${targetName}`, type: 'success' });
      },
      onError: failed('Could not publish this'),
    });
  };

  const onUpdate = async () => {
    if (!current) return;
    const ok = await confirm({
      title: `Update “${blueprint.name}” on ${targetName}?`,
      description: `This updates the design from version ${current.blueprint_version} to ${blueprint.version} on ${targetName}.${changeLine(plan)} Anything you have changed yourself is kept — the update never overwrites your edits.`,
      confirmLabel: 'Update it',
      cancelLabel: 'Cancel',
      color: 'module',
    });
    if (!ok) return;
    update.mutate(current.id, {
      onSuccess: () => {
        refetchInstalls();
        toast.add({
          title: `${blueprint.name} updated to version ${blueprint.version} on ${targetName}`,
          description:
            current.status === 'live'
              ? 'The changes are live. Anything you had edited was kept.'
              : 'The changes are in as drafts. Review and publish when you are ready.',
          type: 'success',
        });
      },
      onError: failed('Could not update this design'),
    });
  };

  const onRemove = async () => {
    if (!current) return;
    const ok = await confirm({
      title: `Remove “${blueprint.name}” from ${targetName}?`,
      description: `This tears the whole design back out of ${targetName} — the pages, content, products and email designs it added are deleted, and its look is cleared. This cannot be undone. Anything you created yourself is left alone.`,
      confirmLabel: 'Remove it',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    uninstall.mutate(current.id, {
      onSuccess: () => {
        refetchInstalls();
        toast.add({ title: `${blueprint.name} removed from ${targetName}`, type: 'success' });
      },
      onError: failed('Could not remove this design'),
    });
  };

  return {
    install,
    goLive,
    update,
    uninstall,
    busy: install.isPending || goLive.isPending || uninstall.isPending || update.isPending,
    onInstall,
    onGoLive,
    onUpdate,
    onRemove,
  };
}
