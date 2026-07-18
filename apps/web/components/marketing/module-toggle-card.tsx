'use client';

import type { LucideIcon } from 'lucide-react';
import { Badge, Card, CardBody, CardTitle, Switch, Text } from '@wizeworks/silicaui-react';
import { MODULE_BACKGROUND_COLOR, MODULE_BORDER_COLOR, MODULE_COLOR } from './modules-catalog';

/**
 * One module tile in a switchboard card grid — icon, name, blurb, an on/off
 * Switch, and a price/status Badge. Shared by /pricing's switchboard and
 * the homepage's switchboard so both surfaces render the identical tile.
 */
export function ModuleToggleCard({
  icon: Icon,
  color,
  label,
  title,
  active,
  disabled,
  onToggle,
  badgeText,
  reason,
}: {
  icon: LucideIcon;
  color: keyof typeof MODULE_COLOR;
  label: string;
  title: string;
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
  badgeText: string;
  reason?: string;
}) {
  return (
    <Card className={`gap-4 border border-1 ${MODULE_BORDER_COLOR[color]}`}>
      <CardBody className="gap-4">
        <div className="flex items-start justify-between">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${MODULE_BACKGROUND_COLOR[color]}`}
          >
            <Icon size={20} color="#FFFFFF" strokeWidth={2} aria-hidden />
          </span>
          <Switch checked={active} onCheckedChange={onToggle} color={color} disabled={disabled} />
        </div>

        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">{label}</CardTitle>
          <Text variant="caption">{title}</Text>
          {reason ? (
            <Text variant="caption" className="text-base-content">
              {reason}
            </Text>
          ) : null}
        </div>

        <Badge color={MODULE_COLOR[color]} variant="soft" className="w-fit">
          {badgeText}
        </Badge>
      </CardBody>
    </Card>
  );
}
