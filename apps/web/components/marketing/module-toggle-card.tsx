'use client';

import type { LucideIcon } from 'lucide-react';
import { Badge, Card, CardBody, CardTitle, Switch, Text } from '@wizeworks/silicaui-react';

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
  badgeColor = 'neutral',
  reason,
}: {
  icon: LucideIcon;
  color: string;
  label: string;
  title: string;
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
  badgeText: string;
  badgeColor?: 'primary' | 'success' | 'neutral';
  reason?: string;
}) {
  return (
    <Card>
      <CardBody className="gap-4">
        <div className="flex items-start justify-between">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: color }}
          >
            <Icon size={20} color="#FFFFFF" strokeWidth={2} aria-hidden />
          </span>
          <Switch checked={active} onCheckedChange={onToggle} color="primary" disabled={disabled} />
        </div>

        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">{label}</CardTitle>
          <Text variant="caption">{title}</Text>
          {reason ? (
            <Text variant="caption" className="text-base-content/50">
              {reason}
            </Text>
          ) : null}
        </div>

        <Badge color={badgeColor} variant="soft" className="w-fit">
          {badgeText}
        </Badge>
      </CardBody>
    </Card>
  );
}
