'use client';

import {
  ColorPicker,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
} from '@wizeworks/silicaui-react';
import {
  faCheck,
  faCopy,
  faLayerGroup,
  faLock,
  faLockOpen,
  faSliders,
  faXmark,
} from '@fortawesome/pro-solid-svg-icons';
import type { PigglesIcon } from '@piggles/ui';
import { Icon } from '@piggles/ui';

/**
 * The controls that live on a swatch.
 *
 * They sit on a color the visitor chose, so they cannot be silica Buttons —
 * every one of those resolves its fill and its ink from tokens, and no token
 * knows what is behind it here. They inherit `currentColor` instead, which the
 * column has already set to whichever of black or white is readable on itself.
 */
function Control({
  icon,
  label,
  onClick,
  pressed,
}: {
  icon: PigglesIcon;
  label: string;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={pressed}
        className={`grid size-9 place-items-center rounded-full border border-current transition-colors hover:bg-current/20 ${
          pressed ? 'bg-current/25 ring-2 ring-current' : ''
        }`}
      >
        <Icon glyph={icon} className="size-4" />
      </button>
    </Tooltip>
  );
}

export function SwatchActions({
  hex,
  locked,
  copied,
  shading,
  removable,
  onCopy,
  onLock,
  onShades,
  onChange,
  onRemove,
}: {
  hex: string;
  locked: boolean;
  copied: boolean;
  shading: boolean;
  removable: boolean;
  onCopy: () => void;
  onLock: () => void;
  onShades: () => void;
  onChange: (hex: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Control
        icon={locked ? faLock : faLockOpen}
        label={locked ? 'Kept — shuffling leaves this one alone' : 'Keep this one when shuffling'}
        pressed={locked}
        onClick={onLock}
      />
      <Control
        icon={copied ? faCheck : faCopy}
        label={copied ? 'Copied' : `Copy ${hex}`}
        onClick={onCopy}
      />
      <Control
        icon={faLayerGroup}
        label="Lighter and darker versions"
        pressed={shading}
        onClick={onShades}
      />

      <Popover>
        <PopoverTrigger>
          <button
            type="button"
            aria-label={`Change ${hex}`}
            className="grid size-9 place-items-center rounded-full border border-current transition-colors hover:bg-current/15"
          >
            <Icon glyph={faSliders} className="size-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-4">
          <ColorPicker value={hex} format="hex" onValueChange={(next) => onChange(next)} />
        </PopoverContent>
      </Popover>

      {removable ? <Control icon={faXmark} label={`Remove ${hex}`} onClick={onRemove} /> : null}
    </div>
  );
}
