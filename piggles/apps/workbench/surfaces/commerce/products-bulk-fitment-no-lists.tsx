'use client';

// What the bulk "What they fit" dialog shows when there is no compatibility list
// to choose from: the read failed, or the catalog has none yet.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Text,
} from '@wizeworks/silicaui-react';
import { loadFailureWords } from '../../lib/api-error';
import type { SurfaceContext } from '../../lib/surfaces/registry';

export function NoLists(props: {
  ctx: SurfaceContext;
  failed: boolean;
  error: unknown;
  onRetry: () => void;
  onClose: () => void;
}) {
  if (props.failed) {
    return (
      <Alert color="danger" variant="soft">
        <AlertContent>
          <AlertTitle>Could not load your compatibility lists</AlertTitle>
          <AlertDescription>
            {loadFailureWords(
              props.error,
              'This is a problem reaching the server. Nothing has been changed.'
            )}
          </AlertDescription>
        </AlertContent>
        <Button size="sm" color="danger" variant="soft" onClick={props.onRetry}>
          Try again
        </Button>
      </Alert>
    );
  }
  return (
    <div className="flex flex-col items-start gap-3">
      <Text>
        Before products can be marked as fitting something, your catalog needs a list of what those
        things are: vehicles, machine models, printers. Set one up and come back.
      </Text>
      <Button
        size="sm"
        color="module"
        onClick={(event) => {
          props.onClose();
          props.ctx.open('commerce.fitment.list', undefined, {
            target: event.shiftKey ? 'beside' : 'tab',
          });
        }}
      >
        Set up a compatibility list
      </Button>
    </div>
  );
}
