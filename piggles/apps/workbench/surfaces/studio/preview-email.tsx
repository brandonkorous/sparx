'use client';

// The email as a recipient gets it.
//
// A step beyond the canvas rather than a correction of it: the canvas is where an
// author DECIDES, and this is the email-safe markup the send actually produces —
// tables, inlined styles, the brand bar and legal footer composed around it, merge
// tags resolved by the same evaluator. If the two ever disagree, this one is right.
//
// It renders the SAVED draft, so the pane says so and offers a refresh rather than
// quietly showing yesterday's words.

import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button } from '@wizeworks/silicaui-react';
import { faArrowsRotate } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneWaiting } from '../../components/pane-waiting';
import { useRenderEmail, type EmailCheck, type EmailPreview } from '../../lib/studio/site-preview';
import { PreviewFrame, type PreviewWidth } from './preview-frame';

/** A check's tone. `pass` is not shown at all — a list of things that are fine is a
 *  list nobody reads, and it buries the two that are not. */
function toneOf(level: EmailCheck['level']): 'warning' | 'error' {
  return level === 'error' ? 'error' : 'warning';
}

export function PreviewEmail({ emailId, name }: { emailId: string; name: string }) {
  const render = useRenderEmail();
  const [preview, setPreview] = useState<EmailPreview | null>(null);
  const [failed, setFailed] = useState(false);
  const [width, setWidth] = useState<PreviewWidth>('full');

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setPreview(await render.mutateAsync(emailId));
    } catch {
      setFailed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (render.isPending && !preview) return <PaneWaiting label="Rendering your email…" />;

  const problems = preview?.checks.filter((check) => check.level !== 'pass') ?? [];

  return (
    <div className="bg-base-200 flex h-full min-h-0 flex-col">
      <Subject
        subject={preview?.subject ?? name}
        busy={render.isPending}
        onRefresh={() => void load()}
      />
      <PreviewFrame
        srcDoc={failed ? undefined : (preview?.html ?? undefined)}
        width={width}
        onWidth={setWidth}
        label={`${name} as a recipient sees it`}
        onRetry={() => void load()}
      >
        <Problems checks={problems} />
      </PreviewFrame>
    </div>
  );
}

function Subject({
  subject,
  busy,
  onRefresh,
}: {
  subject: string;
  busy: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="border-base-300 flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2">
      <span className="text-base-content min-w-0 truncate text-sm">{subject}</span>
      <Button
        size="sm"
        shape="square"
        className="ml-auto"
        aria-label="Refresh"
        title="Show the latest saved version"
        disabled={busy}
        onClick={onRefresh}
      >
        <Icon glyph={faArrowsRotate} className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

function Problems({ checks }: { checks: EmailCheck[] }) {
  if (!checks.length) return null;
  return (
    <div className="border-base-300 flex shrink-0 flex-col gap-2 border-b p-3">
      {checks.map((check) => (
        <Alert key={check.id} color={toneOf(check.level)} variant="soft">
          <span className="flex flex-wrap items-baseline gap-2">
            <Badge color={toneOf(check.level)} variant="soft">
              {check.level === 'error' ? 'Fix this' : 'Worth a look'}
            </Badge>
            <span className="font-medium">{check.title}</span>
            <span>{check.detail}</span>
          </span>
        </Alert>
      ))}
    </div>
  );
}
