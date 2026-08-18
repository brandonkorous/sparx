'use client';

// The panel's own header: which app you are browsing, and the two controls that
// belong to the panel rather than to any screen in it.

import {
  faThumbtack,
  faThumbtackSlash,
  faWandMagicSparkles,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon, type PigglesIcon } from '@piggles/ui';
import { Button, SidebarHeader, SidebarHeaderBrand, Tooltip } from '@wizeworks/silicaui-react';
import { launchAppGuide } from '@/lib/tour/app-tour-offers';
import { GUIDE_KEY_BY_APP } from '@/lib/tour/types';

interface PanelHeaderProps {
  appId: string;
  label: string;
  icon: PigglesIcon;
  pinned: boolean;
  pinnable: boolean;
  onTogglePin: () => void;
}

export function PanelHeader({
  appId,
  label,
  icon,
  pinned,
  pinnable,
  onTogglePin,
}: PanelHeaderProps) {
  const guideKey = GUIDE_KEY_BY_APP[appId];

  return (
    <SidebarHeader>
      <SidebarHeaderBrand>
        {/* The SAME icon the rail shows for this app — the panel is the rail item
            opened up, so its header has to be recognisably that item. */}
        <Icon glyph={icon} className="text-module size-5 shrink-0" aria-hidden />
        {/* At `text-sm` this was a 14px heading over 16px rows — a heading smaller
            than its own contents, inverting the hierarchy it exists to state. */}
        <span className="min-w-0 truncate text-base font-semibold" title={label}>
          {label}
        </span>
      </SidebarHeaderBrand>

      {pinnable ? (
        <Tooltip content={pinned ? 'Unpin — hide after opening' : 'Pin — keep this open'}>
          <Button
            size="xs"
            shape="square"
            aria-pressed={pinned}
            aria-label={pinned ? 'Unpin the navigation panel' : 'Pin the navigation panel'}
            onClick={onTogglePin}
          >
            <Icon
              glyph={pinned ? faThumbtackSlash : faThumbtack}
              className="size-3.5"
              aria-hidden
            />
          </Button>
        </Tooltip>
      ) : null}

      {/* The way back to a walk somebody said no to months ago. Rendered only
          where a guide exists, so it is never a control that does nothing. */}
      {guideKey ? (
        <Tooltip content={`A quick walk through ${label}`}>
          <Button
            size="xs"
            shape="square"
            aria-label={`Show me around ${label}`}
            onClick={() => {
              launchAppGuide(guideKey);
            }}
          >
            <Icon glyph={faWandMagicSparkles} className="size-3.5" aria-hidden />
          </Button>
        </Tooltip>
      ) : null}
    </SidebarHeader>
  );
}
