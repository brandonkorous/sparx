'use client';

// The version history of one rule — every time it was published, newest first.
//
// Publishing snapshots the rule, so this is an append-only record: "Restore"
// never rewinds it, it copies a chosen snapshot back into the working draft for
// you to review and publish again (which appends a NEW version). Because restore
// overwrites the current draft, it is a named confirm and is blocked while there
// are unsaved edits on the form.

import { Badge, Button, Text, Timestamp, useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { History, RotateCcw } from 'lucide-react';
import { afterPaneChange } from '../../lib/defer';
import {
  automationErrorMessage,
  useAutomationVersions,
  useRestoreVersion,
  type Automation,
  type AutomationVersionRow,
} from './automations-data';

function VersionRow({
  version,
  isLive,
  disabled,
  onRestore,
}: {
  version: AutomationVersionRow;
  isLive: boolean;
  disabled: boolean;
  onRestore: () => void;
}) {
  return (
    <div className="border-base-300 flex flex-wrap items-center gap-x-3 gap-y-1 border-b py-3 last:border-b-0">
      <span className="shrink-0 text-sm font-semibold">Version {version.version}</span>
      {isLive ? (
        <Badge color="success" variant="soft" size="sm">
          Live
        </Badge>
      ) : null}
      <Text as="span" className="min-w-0 flex-1 text-sm">
        {version.note ?? 'No note'}
      </Text>
      <Text as="span" className="shrink-0 text-sm">
        <Timestamp value={version.publishedAt} format="relative" />
      </Text>
      {isLive ? null : (
        <Button
          size="sm"
          variant="outline"
          color="neutral"
          className="shrink-0"
          disabled={disabled}
          title={
            disabled
              ? 'Save or discard your current changes first'
              : 'Bring this version back as a draft'
          }
          onClick={onRestore}
        >
          <RotateCcw className="size-4" aria-hidden />
          Restore
        </Button>
      )}
    </div>
  );
}

export function HistoryPanel({
  id,
  liveVersion,
  dirty,
  onRestored,
}: {
  id: string;
  liveVersion: number;
  /** Unsaved form edits — restore is blocked until they're saved or discarded. */
  dirty: boolean;
  /** Fired with the restored automation so the editor loads its new draft. */
  onRestored: (automation: Automation) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data: versions, isPending, isError } = useAutomationVersions(id);
  const restore = useRestoreVersion(id);

  const onRestore = async (version: AutomationVersionRow) => {
    const ok = await confirm({
      title: `Restore version ${String(version.version)}?`,
      description:
        'This brings that version back as an unpublished draft, replacing any draft you have now. Nothing goes live until you review it and publish.',
      confirmLabel: 'Restore it as a draft',
      cancelLabel: 'Cancel',
      color: 'warning',
    });
    if (!ok) return;
    restore.mutate(version.version, {
      onSuccess: (restored) => {
        onRestored(restored);
        afterPaneChange(() => {
          toast.add({
            title: `Version ${String(version.version)} restored as a draft`,
            description: 'Review the changes, then publish to make them live.',
            type: 'success',
          });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not restore that version',
          description: automationErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  if (isError) {
    return <Text className="text-sm">Could not load the history just now.</Text>;
  }
  if (isPending) {
    return (
      <Text className="text-sm" role="status">
        Loading…
      </Text>
    );
  }
  if (!versions || versions.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <History className="size-4 shrink-0" aria-hidden />
        <Text className="text-sm">No published versions yet.</Text>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {versions.map((version) => (
        <VersionRow
          key={version.id}
          version={version}
          isLive={version.version === liveVersion}
          disabled={dirty || restore.isPending}
          onRestore={() => {
            void onRestore(version);
          }}
        />
      ))}
    </div>
  );
}
