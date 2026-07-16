'use client';

// Industry picker — a card per vertical (apparel, salon, wholesale, …). Each card
// shows what the starter spans: a row of MODULE chips, each wearing its own module
// hue (color-follows-functionality — a nested <ModuleProvider> per chip, since the
// settings route carries no module color of its own), with disabled modules dimmed.
// Setting up an industry stamps every applicable preset and records it as the active
// industry. The action is purely additive + idempotent (it fills empty slots only —
// it never removes or migrates existing data), so there's no destructive confirm —
// just a result toast summarizing what landed.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  Car,
  Compass,
  Cpu,
  Dumbbell,
  Scissors,
  Shirt,
  Utensils,
  Warehouse,
} from 'lucide-react';
import { Card, ModuleProvider, toast } from '@sparx/ui';
import { Badge, Button } from '@wizeworks/silicaui-react';

import { installIndustryStarterAction, type IndustryStarterView } from '../actions';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  shirt: Shirt,
  utensils: Utensils,
  cpu: Cpu,
  car: Car,
  scissors: Scissors,
  dumbbell: Dumbbell,
  briefcase: Briefcase,
  warehouse: Warehouse,
};

// Module display labels (acronyms stay uppercase).
const MODULE_LABELS: Record<string, string> = {
  crm: 'CRM',
  cms: 'CMS',
  b2b: 'B2B',
  ai: 'AI',
};
const moduleLabel = (m: string): string =>
  MODULE_LABELS[m] ?? m.charAt(0).toUpperCase() + m.slice(1);

// ModuleProvider's `module` prop is a typed union; the slug arrives as a string
// over the wire. Every ModuleSlug is a valid SparxModule, so the cast is sound.
type SparxModuleName = React.ComponentProps<typeof ModuleProvider>['module'];

interface Props {
  starters: IndustryStarterView[];
  activeSlug: string | null;
  canEdit: boolean;
}

export function IndustryPicker({ starters, activeSlug, canEdit }: Props) {
  const router = useRouter();
  const [installing, setInstalling] = React.useState<string | null>(null);

  function onChoose(starter: IndustryStarterView): void {
    setInstalling(starter.slug);
    void (async () => {
      try {
        const res = await installIndustryStarterAction(starter.slug);
        if (res.ok) {
          const { installed, alreadyInstalled, skipped } = res.data;
          const parts = [`${installed.length} pack${installed.length === 1 ? '' : 's'} installed`];
          if (alreadyInstalled.length) parts.push(`${alreadyInstalled.length} already present`);
          if (skipped.length) parts.push(`${skipped.length} skipped (module off)`);
          toast.success(`${starter.name} — config installed`, { description: parts.join(' · ') });
          router.refresh();
        } else {
          toast.error("Couldn't set industry", { description: res.error.message });
        }
      } finally {
        setInstalling(null);
      }
    })();
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {starters.map((starter) => {
        const Icon = ICONS[starter.iconKey] ?? Compass;
        const isActive = starter.slug === activeSlug;
        const enabled = new Set(starter.enabledModules);
        return (
          <Card
            key={starter.slug}
            variant="subtle"
            padding="md"
            className={isActive ? 'ring-success h-full ring-1' : 'h-full'}
          >
            <div className="flex h-full flex-col gap-2">
              <div className="flex flex-row items-center gap-2">
                <Icon className="text-base-content h-4 w-4" />
                <p className="flex-1 font-medium">{starter.name}</p>
                {isActive && (
                  <Badge color="success" variant="soft" size="sm">
                    Current
                  </Badge>
                )}
              </div>

              <p className="text-base-content flex-1 text-xs">{starter.description}</p>

              <div className="flex flex-row flex-wrap gap-1">
                {starter.modules.map((m) =>
                  enabled.has(m) ? (
                    <ModuleProvider key={m} module={m as SparxModuleName} className="inline-flex">
                      <Badge color="module" variant="soft" size="sm">
                        {moduleLabel(m)}
                      </Badge>
                    </ModuleProvider>
                  ) : (
                    <Badge key={m} variant="soft" size="sm" className="opacity-50">
                      {moduleLabel(m)} · off
                    </Badge>
                  )
                )}
              </div>

              <p className="text-base-content text-xs">
                {starter.applicablePresetCount} of {starter.totalPresetCount} packs apply to your
                enabled modules.
              </p>

              <Button
                color="primary"
                variant={isActive ? 'soft' : 'solid'}
                size="sm"
                onClick={() => onChoose(starter)}
                loading={installing === starter.slug}
                disabled={!canEdit || installing !== null}
              >
                {isActive ? 'Re-run setup' : 'Set up this industry'}
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
