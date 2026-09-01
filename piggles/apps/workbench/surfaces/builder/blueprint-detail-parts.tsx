'use client';

// The read-only halves of the design pane: the preview, what the design is
// currently doing on the chosen site, and what it brings.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Text,
} from '@wizeworks/silicaui-react';
import { faArrowCircleUp, faTableLayout } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { FormSection } from '../../components/form-section';
import { PaneToolbar } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import {
  contentsGroups,
  formatDate,
  installState,
  moduleLabel,
  type ContentsLine,
  type Tone,
} from './blueprints-words';
import type { Blueprint, BlueprintInstall } from './blueprints-data';
import type { UpdatePlan } from './blueprints-update';

export function BlueprintPreview({ blueprint }: { blueprint: Blueprint }) {
  if (!blueprint.preview) {
    return (
      <div className="bg-base-200 border-base-300 flex aspect-video w-full items-center justify-center rounded-lg border">
        <Icon glyph={faTableLayout} className="size-10 [color:var(--color-module)]" aria-hidden />
      </div>
    );
  }
  // Hot-linked marketplace preview on an arbitrary CDN — not an allow-listed
  // media host, so `next/image` would reject it (it THROWS on an un-allow-listed
  // host). A plain <img> is correct here.
  return (
    <img
      src={blueprint.preview}
      alt={`Preview of the ${blueprint.name} design`}
      className="bg-base-200 border-base-300 aspect-video w-full rounded-lg border object-cover"
    />
  );
}

/** What this design is doing on the chosen site right now, including whether its
 *  examples came with it — a fact about THIS install, never inferred from a zero. */
export function InstallStatusAlert({
  install,
  targetName,
}: {
  install: BlueprintInstall;
  targetName: string;
}) {
  const state = installState(install.status);
  const when =
    install.status === 'live' && install.live_at
      ? ` Live since ${formatDate(install.live_at)}.`
      : install.installed_at
        ? ` Added ${formatDate(install.installed_at)}.`
        : '';
  return (
    <Alert color={state.tone} variant="soft">
      <AlertContent>
        <AlertTitle>
          {state.label} on {targetName}
        </AlertTitle>
        <AlertDescription>
          {state.detail}
          {when}
          {install.sample_data ? ' Its examples came with it.' : ' Its examples were left out.'}
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}

export function UpdateAlert({
  blueprint,
  install,
  plan,
  pending,
  disabled,
  onUpdate,
}: {
  blueprint: Blueprint;
  install: BlueprintInstall;
  plan: UpdatePlan | undefined;
  pending: boolean;
  disabled: boolean;
  onUpdate: () => void;
}) {
  const adds =
    plan?.summary && plan.summary.new > 0
      ? ` It adds ${String(plan.summary.new)} new ${plan.summary.new === 1 ? 'thing' : 'things'} (like new pages).`
      : '';
  return (
    <Alert color="module" variant="soft">
      <AlertContent>
        <AlertTitle>Update available</AlertTitle>
        <AlertDescription>
          {targetVersionLine(install, blueprint)}
          {adds} Updating keeps everything you have edited yourself.
          {install.sample_data
            ? ''
            : ' This design came in without its examples, and the update leaves them out too.'}
        </AlertDescription>
      </AlertContent>
      <Button size="sm" color="module" loading={pending} disabled={disabled} onClick={onUpdate}>
        <Icon glyph={faArrowCircleUp} className="size-4" aria-hidden />
        Update to {blueprint.version}
      </Button>
    </Alert>
  );
}

function targetVersionLine(install: BlueprintInstall, blueprint: Blueprint): string {
  return `This site has version ${install.blueprint_version} of this design; version ${blueprint.version} is now available.`;
}

function LineList({ lines }: { lines: ContentsLine[] }) {
  return (
    <ul className="flex flex-col">
      {lines.map((line) => (
        <li key={line.key} className="border-base-300 border-b py-2 text-base last:border-b-0">
          {line.text}
        </li>
      ))}
    </ul>
  );
}

/** What the design brings, in the two groups the install itself works in: the
 *  structure it always brings, and the examples the next section makes a choice. */
export function BlueprintContentsSection({
  blueprint,
  offModules,
}: {
  blueprint: Blueprint;
  offModules: string[];
}) {
  const groups = contentsGroups(blueprint.contents);
  // `contents` is free-form JSON on the wire, so read the theme name defensively
  // — a non-string would render as `[object Object]` or crash React.
  const themeName = typeof blueprint.contents.theme === 'string' ? blueprint.contents.theme : null;
  const empty = groups.structure.length === 0 && groups.examples.length === 0;

  return (
    <FormSection
      title="What this adds to your site"
      // NOT "nothing here replaces what you already have" — it does. What is true
      // of every install, whichever site it goes to, is the drafts. What it does
      // to THAT site is said beside the site picker, where the site is known.
      description="Everything comes in as drafts you can change, and nothing is live until you publish it."
    >
      {empty ? (
        <Text className="text-sm">
          A clean starting layout to build on, with a matching look already set up.
        </Text>
      ) : (
        <LineList lines={groups.structure} />
      )}
      {themeName ? (
        <Text className="text-sm">
          Comes with the <span className="font-medium">{themeName}</span> look — colors, fonts and
          spacing — applied for you.
        </Text>
      ) : null}

      {groups.examples.length > 0 ? (
        <>
          <Text className="font-medium">The examples it brings</Text>
          <LineList lines={groups.examples} />
          <Text className="text-sm">
            These are somebody else&rsquo;s: a shop&rsquo;s stock, a salon&rsquo;s treatments, a
            writer&rsquo;s articles. They are there so every screen has something real on it while
            you find your way around. You can leave them out below.
          </Text>
        </>
      ) : null}

      {offModules.length > 0 ? (
        <Text className="text-sm">
          Some of this needs features you have turned off
          {' ('}
          {offModules.map((slug) => moduleLabel(slug)).join(', ')}
          {'). '}
          Those parts are skipped — turn the feature on first if you want them included.
        </Text>
      ) : null}
    </FormSection>
  );
}

/** The pane's own chrome: what this design is on the CHOSEN site (not the active
 *  one), whether a newer version exists, and a refresh for both reads. */
export function BlueprintToolbar({
  status,
  updateAvailable,
  isFetching,
  updatedAt,
  onRefresh,
}: {
  status: { label: string; tone: Tone } | null;
  updateAvailable: boolean;
  isFetching: boolean;
  updatedAt: number;
  onRefresh: () => void;
}) {
  return (
    <PaneToolbar
      label="Blueprint actions"
      status={
        <>
          {status ? (
            <Badge color={status.tone} variant="soft" size="sm">
              {status.label}
            </Badge>
          ) : (
            <Text className="text-sm">Preview</Text>
          )}
          {updateAvailable ? (
            <Badge color="module" variant="soft" size="sm">
              Update available
            </Badge>
          ) : null}
        </>
      }
      refresh={
        <RefreshButton isFetching={isFetching} updatedAt={updatedAt} onRefresh={onRefresh} />
      }
    />
  );
}
