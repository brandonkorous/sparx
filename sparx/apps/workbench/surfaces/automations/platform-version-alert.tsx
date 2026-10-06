'use client';

// The editor's notice that sparx has a newer version of a rule it set up, and the
// way to take it.
//
// The re-sync left the business's version alone because they changed it. This is
// where they learn sparx's has moved on, and where they can switch: the confirm
// shows what differs part by part, says what stays (the name, on or off), and that
// their current version is kept in the history. The switch is a publish on the
// server, so it waits until there are no unpublished changes of theirs to strand.

import { useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  useToast,
} from '@wizeworks/silicaui-react';
import type { AutomationStatus } from '@wizeworks/automation-schemas';
import { useConfirm } from '../../lib/confirm';
import { useReaderClock } from '../../lib/business-timezone';
import { ruleWords } from './automations-presentation';
import {
  automationErrorMessage,
  useTakePlatformVersion,
  type Automation,
  type PlatformDocument,
} from './automations-data';
import {
  PLATFORM_UPDATE_TEXT,
  PLATFORM_VERSION_WORDS as WORDS,
  platformVersionChanges,
  type RulePartChange,
} from './platform-version';

/** The live rule in the same shape as sparx's version, for the comparison. */
function liveDocument(a: Automation): PlatformDocument {
  return {
    description: a.description,
    triggerType: a.triggerType,
    triggerConfig: a.triggerConfig,
    conditions: a.conditions,
    actions: a.actions,
    goal: a.goal,
    maxDepth: a.maxDepth,
  };
}

/** One side of one part. Spans throughout: the confirm renders its description
 *  inside a paragraph, which cannot hold a list or a div. */
function Side({ who, lines }: { who: string; lines: string[] }) {
  return (
    <>
      <span className="font-semibold">{who}</span>
      <span className="flex min-w-0 flex-col">
        {lines.map((line, i) => (
          <span key={i} className="break-words">
            {line}
          </span>
        ))}
      </span>
    </>
  );
}

function ChangeList({ changes }: { changes: RulePartChange[] }) {
  if (changes.length === 0) return <span className="block">{WORDS.confirmNoDetail}</span>;
  return (
    <span className="flex flex-col gap-3">
      {changes.map((change) => (
        <span key={change.part} className="flex flex-col gap-1">
          <span className="font-semibold">{change.label}</span>
          <span className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
            <Side who={WORDS.yours} lines={change.yours} />
            <Side who={WORDS.theirs} lines={change.theirs} />
          </span>
          {change.hidden ? <span className="block">{WORDS.hiddenNote}</span> : null}
        </span>
      ))}
    </span>
  );
}

export function PlatformVersionAlert({
  automation,
  name,
  status,
  blocked,
  onTaken,
}: {
  automation: Automation;
  /** The rule's name as the editor shows it now. */
  name: string;
  status: AutomationStatus;
  /** Unpublished changes exist: the switch would strand them, so it waits. */
  blocked: boolean;
  /** Fired with the switched rule so the editor reloads its document. */
  onTaken: (taken: Automation) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const clock = useReaderClock();
  const take = useTakePlatformVersion(automation.id);
  // Hidden the moment the switch lands, not when the refetch does.
  const [takenId, setTakenId] = useState<string | null>(null);

  if (!automation.platformUpdateAt || takenId === automation.id) return null;
  const platform = automation.platformDocument;

  const onTake = async () => {
    if (!platform) return;
    const changes = platformVersionChanges(liveDocument(automation), platform, ruleWords(clock));
    const ok = await confirm({
      title: WORDS.confirmTitle(name),
      description: (
        <span className="flex flex-col gap-3">
          <span className="block">{WORDS.confirmLead}</span>
          <ChangeList changes={changes} />
          <span className="block">{WORDS.confirmKeeps(name, status)}</span>
        </span>
      ),
      confirmLabel: WORDS.confirmLabel,
      cancelLabel: WORDS.cancelLabel,
      color: 'warning',
    });
    if (!ok) return;
    take.mutate(undefined, {
      onSuccess: (taken) => {
        setTakenId(taken.id);
        onTaken(taken);
        toast.add({ title: WORDS.doneTitle, description: WORDS.doneDetail, type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: WORDS.failedTitle,
          description: automationErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const hint = !platform ? WORDS.notReady : blocked ? WORDS.blocked : null;

  return (
    <Alert color="warning" className="shrink-0">
      <AlertContent>
        <AlertTitle>{PLATFORM_UPDATE_TEXT.title}</AlertTitle>
        <AlertDescription>
          {PLATFORM_UPDATE_TEXT.detail}
          {hint ? ` ${hint}` : ''}
        </AlertDescription>
      </AlertContent>
      {platform ? (
        <Button
          size="sm"
          color="warning"
          className="shrink-0"
          loading={take.isPending}
          disabled={blocked}
          onClick={() => {
            void onTake();
          }}
        >
          {WORDS.button}
        </Button>
      ) : null}
    </Alert>
  );
}
