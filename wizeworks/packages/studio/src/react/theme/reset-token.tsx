'use client';

// Put one token back to what it was before anyone touched it.
//
// Offered where clearing MEANS something. In dark mode a cleared token follows
// the light value, and a cleared `-content` goes back to being chosen for
// legibility — both are useful answers. Clearing a light-mode brand color is not:
// it drops the theme to silica's own default, which is a jump to an unrelated
// blue rather than a way back, so that row does not carry the control at all.

import { Button, Tooltip } from '@wizeworks/silicaui-react';
import { StudioIcon } from '../icon';
import { useThemeEdit } from './edit-context';

export function ResetToken({
  token,
  label,
  /** True for a token whose cleared state is "work it out for me" rather than
   *  "fall back to a default from somewhere else". */
  automatic,
}: {
  token: string;
  label: string;
  automatic?: boolean;
}) {
  const { mode, own, editable, setToken } = useThemeEdit();
  if (!editable || own[token] === undefined) return null;
  if (mode !== 'dark' && !automatic) return null;

  const what =
    mode === 'dark'
      ? `Use the light-mode ${label.toLowerCase()}`
      : `Go back to choosing ${label.toLowerCase()} automatically`;

  return (
    <Tooltip content={what}>
      <Button
        size="sm"
        shape="circle"
        className="shrink-0"
        aria-label={what}
        onClick={() => setToken(token, undefined, `Reset ${label}`)}
      >
        <StudioIcon name="undo" className="text-base" />
      </Button>
    </Tooltip>
  );
}
