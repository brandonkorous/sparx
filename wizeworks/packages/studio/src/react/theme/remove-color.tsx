'use client';

// Taking an invented color back out.
//
// Both halves go — the color and any ink written for it — because a stranded
// `--color-sale-content` generates a rule for a color that no longer exists, and
// a role that is half-present is exactly the state nothing downstream checks for.
//
// One undo step: the two ops are one batch, so putting it back is one action.

import { Button, Tooltip } from '@wizeworks/silicaui-react';
import { useApply } from '../context';
import { StudioIcon } from '../icon';
import { useThemeEdit } from './edit-context';

export function RemoveColor({ token, label }: { token: string; label: string }) {
  const { mode, editable } = useThemeEdit();
  const apply = useApply();
  if (!editable) return null;

  return (
    <Tooltip content={`Remove ${label}`}>
      <Button
        size="sm"
        shape="circle"
        color="danger"
        variant="soft"
        className="shrink-0"
        aria-label={`Remove ${label}`}
        onClick={() =>
          apply(`Remove ${label}`, [
            { kind: 'theme.setToken', mode, token, value: undefined },
            { kind: 'theme.setToken', mode, token: `${token}-content`, value: undefined },
          ])
        }
      >
        <StudioIcon name="trash" className="text-base" />
      </Button>
    </Tooltip>
  );
}
