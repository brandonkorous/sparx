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
import type { NewSiteTarget } from './blueprint-new-site';
import { blueprintErrorMessage, examplesSentence, installImpact } from './blueprints-words';

export interface ActionsInput {
  blueprint: Blueprint;
  /** The site every action targets. Empty until the sites list loads. */
  targetSite: string;
  targetName: string;
  /** How many pages the target site has, so the confirm can name what goes.
   *  Undefined while the sites list is still loading, or on a build of api-rest
   *  that predates the count — the impact sentence handles both without
   *  guessing. */
  targetPageCount: number | undefined;
  /** The "A new site" option. When it is the chosen target, installing makes the
   *  site first and puts the design in that. */
  newSite: NewSiteTarget;
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
  const {
    blueprint,
    targetSite,
    targetName,
    targetPageCount,
    newSite,
    current,
    plan,
    refetchInstalls,
  } = input;
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
    if (newSite.chosen && !newSite.ready) return;
    // The confirm is sized to the site. On an empty one this is an ordinary add;
    // on a site that has pages it DESTROYS them, so it asks a different question,
    // in danger, with a button that says what it does. The previous single
    // sentence promised "your existing pages and products are left exactly as
    // they are" in both cases, and in the second case that was not true.
    const impact = installImpact(targetName, targetPageCount);
    const replacing = impact.replaces && !newSite.chosen;
    const ok = await confirm({
      title: newSite.chosen
        ? `Make ${targetName} from “${blueprint.name}”?`
        : replacing
          ? impact.pages === null
            ? `Replace what is on ${targetName}?`
            : `Replace the ${impact.pages === 1 ? 'page' : `${String(impact.pages)} pages`} on ${targetName}?`
          : `Add “${blueprint.name}” to ${targetName}?`,
      description: newSite.chosen
        ? `This makes a new site called ${targetName}${newSite.host ? ` at ${newSite.host}` : ''} and puts this design in it, all as drafts only you can see. The site you have now is left exactly as it is. ${examplesSentence(sampleData)}`
        : `${impact.sentence} ${examplesSentence(sampleData)}`,
      confirmLabel: newSite.chosen
        ? 'Make the site'
        : replacing
          ? impact.pages === 1
            ? 'Replace the page'
            : 'Replace the pages'
          : 'Add it',
      cancelLabel: 'Cancel',
      color: replacing ? 'danger' : 'module',
    });
    if (!ok) return;

    // The site has to exist before the design can go in it, and a failure here
    // must not read as a failed install: nothing has been installed yet, and the
    // site may or may not have been made. Its own message says which.
    const made = newSite.chosen;
    let propertyId = targetSite;
    if (made) {
      try {
        propertyId = await newSite.create();
      } catch (error) {
        failed('Could not make the site')(error);
        return;
      }
      // Point the picker at it the MOMENT it exists, not when the install
      // succeeds. A design that fails to install leaves a real site behind, and
      // the pane was staying on "A new site" with the name still in the box —
      // so it reported "that address is taken" about the site it had just made,
      // and the failed install it needs to show was on a site nothing pointed at.
      newSite.settle(propertyId);
    }

    install.mutate(
      { propertyId, sampleData },
      {
        onSuccess: () => {
          refetchInstalls();
          afterPaneChange(() => {
            toast.add({
              title: made
                ? `${targetName} made from ${blueprint.name}`
                : `${blueprint.name} added to ${targetName}`,
              description: made
                ? 'The site is yours, with this design in it as drafts. Review it, then publish it when you are ready.'
                : 'It is on your site as drafts. Review it, then publish it when you are ready.',
              type: 'success',
            });
          });
        },
        onError: (error) => {
          // The site survives a failed install, so the message says so rather
          // than leaving her to wonder whether one was made.
          refetchInstalls();
          failed(
            made
              ? `${targetName} was made, but the design did not go in`
              : 'Could not add this design'
          )(error);
        },
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
