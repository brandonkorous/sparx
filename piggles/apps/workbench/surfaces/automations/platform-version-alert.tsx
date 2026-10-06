'use client';

// We improved a rule we set up, and held it back because the business changed
// theirs. The list badges it; the editor says so here and offers ours, with a
// confirm that shows what differs and what stays.

import { useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  useToast,
  type BadgeSize,
} from '@wizeworks/silicaui-react';
import { isConditionGroup, type AutomationStatus } from '@wizeworks/automation-schemas';
import { useConfirm } from '../../lib/confirm';
import { useReaderClock } from '../../lib/business-timezone';
import {
  actionSummaryText,
  conditionToText,
  conditionsHeadline,
  parseActions,
  summarizeTrigger,
} from './automations-presentation';
import {
  automationErrorMessage,
  useTakePlatformVersion,
  type Automation,
  type PlatformDocument,
} from './automations-data';
import {
  PLATFORM_UPDATE_TEXT as TEXT,
  PLATFORM_VERSION_WORDS as WORDS,
  platformVersionChanges,
  type RulePartChange,
  type RuleWords,
} from './platform-version';
import type { ReaderClock } from './schedule-clock';

/** A rule's parts in the flow map's words. */
function ruleWords(clock: ReaderClock): RuleWords {
  return {
    trigger: (type, config) => summarizeTrigger(type, config, clock),
    conditions: (group, none) =>
      group.conditions.length === 0
        ? [none]
        : [
            conditionsHeadline(group),
            ...group.conditions.map((node) =>
              isConditionGroup(node) ? 'A group of checks' : conditionToText(node)
            ),
          ],
    steps: (actions) =>
      parseActions(actions).map((action, i) => `${String(i + 1)}. ${actionSummaryText(action)}`),
  };
}

function liveDocument(a: Automation): PlatformDocument {
  const { description, triggerType, triggerConfig, conditions, actions, goal, maxDepth } = a;
  return { description, triggerType, triggerConfig, conditions, actions, goal, maxDepth };
}

/** On a list row: we have a newer version of this one. The row opens the editor. */
export function PlatformUpdateBadge({
  platformUpdateAt,
  size = 'sm',
}: {
  platformUpdateAt: string | null;
  size?: BadgeSize;
}) {
  if (!platformUpdateAt) return null;
  return (
    <Badge color="warning" variant="soft" size={size} title={TEXT.badgeTitle}>
      {TEXT.label}
    </Badge>
  );
}

/** Spans only: the confirm puts its description inside a paragraph. */
function ChangeList({ changes }: { changes: RulePartChange[] }) {
  if (changes.length === 0) return <span className="block">{WORDS.confirmNoDetail}</span>;
  const side = (who: string, lines: string[]) => (
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
  return (
    <span className="flex flex-col gap-3">
      {changes.map((change) => (
        <span key={change.part} className="flex flex-col gap-1">
          <span className="font-semibold">{change.label}</span>
          <span className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
            {side(WORDS.yours, change.yours)}
            {side(WORDS.theirs, change.theirs)}
          </span>
          {change.hidden ? <span className="block">{WORDS.hiddenNote}</span> : null}
        </span>
      ))}
    </span>
  );
}

interface AlertProps {
  automation: Automation;
  /** The name as the editor shows it now. */
  name: string;
  status: AutomationStatus;
  /** Unpublished changes would be stranded by the switch, so it waits. */
  blocked: boolean;
  onTaken: (taken: Automation) => void;
}

/** Confirm, then switch. Resolves the switched rule, or null if it did not. */
function useTakeFlow({ automation, name, status }: AlertProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const clock = useReaderClock();
  const take = useTakePlatformVersion(automation.id);

  const run = async (platform: PlatformDocument): Promise<Automation | null> => {
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
    if (!ok) return null;
    try {
      const taken = await take.mutateAsync();
      toast.add({ title: WORDS.doneTitle, description: WORDS.doneDetail, type: 'success' });
      return taken;
    } catch (error) {
      toast.add({
        title: WORDS.failedTitle,
        description: automationErrorMessage(error, 'Nothing was changed.'),
        type: 'error',
      });
      return null;
    }
  };
  return { run, pending: take.isPending };
}

export function PlatformVersionAlert(props: AlertProps) {
  const { automation, blocked, onTaken } = props;
  const flow = useTakeFlow(props);
  // Gone the moment the switch lands, not when the refetch does.
  const [takenId, setTakenId] = useState<string | null>(null);
  if (!automation.platformUpdateAt || takenId === automation.id) return null;

  const platform = automation.platformDocument;
  const hint = !platform ? WORDS.notReady : blocked ? WORDS.blocked : null;
  const onClick = async () => {
    if (!platform) return;
    const taken = await flow.run(platform);
    if (!taken) return;
    setTakenId(taken.id);
    onTaken(taken);
  };

  return (
    <Alert color="warning" className="shrink-0">
      <AlertContent>
        <AlertTitle>{TEXT.title}</AlertTitle>
        <AlertDescription>
          {TEXT.detail}
          {hint ? ` ${hint}` : ''}
        </AlertDescription>
      </AlertContent>
      {platform ? (
        <Button
          size="sm"
          color="warning"
          className="shrink-0"
          loading={flow.pending}
          disabled={blocked}
          onClick={() => {
            void onClick();
          }}
        >
          {WORDS.button}
        </Button>
      ) : null}
    </Alert>
  );
}
