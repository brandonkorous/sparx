'use client';

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
} from '@wizeworks/silicaui-react';
import { PlatformVersionAlert } from '../platform-version-alert';
import type { Health } from '../automation-health';
import type { EditorHandlers } from './lifecycle-handlers';
import { targetFor } from '../target-for';
import type { EditorState } from './use-editor-state';

interface AlertsProps {
  ed: EditorState;
  h: EditorHandlers;
  health: Health | null;
}

function HealthBanner({ ed, health }: Omit<AlertsProps, 'h'>) {
  const { automation, ctx } = ed;
  return health && automation ? (
    <Alert color={health.tone === 'error' ? 'error' : 'warning'} className="shrink-0">
      <AlertContent>
        <AlertTitle>{health.label}</AlertTitle>
        <AlertDescription>{health.inside}</AlertDescription>
      </AlertContent>
      <Button
        size="sm"
        color={health.tone === 'error' ? 'danger' : 'warning'}
        className="shrink-0"
        onClick={(event) => {
          ctx.open(
            'automations.runs',
            { automationId: automation.id, result: 'failed' },
            { target: targetFor(event) }
          );
        }}
      >
        See what went wrong
      </Button>
    </Alert>
  ) : null;
}

export function EditorAlerts({ ed, h, health }: AlertsProps) {
  const { error, isNew, automation, name, status, hasUnpublished } = ed;
  const { onPlatformTaken } = h;
  return (
    <>
      {error ? (
        <Alert color="error" className="shrink-0">
          <AlertContent>
            <AlertTitle>{isNew ? 'Cannot create this yet' : 'Cannot save this yet'}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      {/* A badge she has to hover is not enough for "this rule has never once
          worked". The banner says it, and carries the way to the failures. */}
      <HealthBanner ed={ed} health={health} />

      {/* We improved a rule we set up and kept theirs: say so, and offer ours. */}
      {automation ? (
        <PlatformVersionAlert
          automation={automation}
          name={name}
          status={status}
          blocked={hasUnpublished}
          onTaken={onPlatformTaken}
        />
      ) : null}
    </>
  );
}
