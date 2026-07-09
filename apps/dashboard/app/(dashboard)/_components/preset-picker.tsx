'use client';

// Shared module-preset picker — browse the platform's installable config packs
// (fitment dictionaries today; tax zones, pipelines, taxonomies, … as later
// waves register them) and install one with a click. Generic across modules:
// the fitment page passes its commerce/fitment presets; a future cross-module
// "browse your presets" surface passes the whole enabled set.
//
// Color-follows-functionality: each card wears ITS module's hue via a per-card
// <ModuleProvider>. The modal renders in a Radix portal (document.body), OUTSIDE
// any route ModuleProvider, so each card must re-establish its own — otherwise
// `--module-active` falls back to :root indigo (the portal footgun in
// packages/ui/CLAUDE.md). h-full chains down the provider → card → stack so
// cards keep equal heights in the grid.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AirVent,
  Bike,
  Boxes,
  Car,
  Construction,
  Disc,
  Footprints,
  Glasses,
  Guitar,
  PawPrint,
  Receipt,
  Ship,
  Shirt,
  Smartphone,
  Sofa,
  WashingMachine,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Grid,
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
  ModuleProvider,
  Stack,
  Text,
  toast,
} from '@sparx/ui';

import { installPresetAction, type ModulePresetView } from './preset-actions';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  car: Car,
  smartphone: Smartphone,
  shirt: Shirt,
  'paw-print': PawPrint,
  construction: Construction,
  footprints: Footprints,
  bike: Bike,
  glasses: Glasses,
  disc: Disc,
  'air-vent': AirVent,
  sofa: Sofa,
  ship: Ship,
  guitar: Guitar,
  'washing-machine': WashingMachine,
  receipt: Receipt,
};

// ModuleProvider's `module` prop is a typed union; the preset's module arrives
// as a string over the wire. Every ModuleSlug is a valid SparxModule, so the
// cast is sound.
type SparxModuleName = React.ComponentProps<typeof ModuleProvider>['module'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presets: ModulePresetView[];
  title: string;
  description: string;
  /** Server path revalidated after a successful install (e.g. '/commerce/fitment'). */
  revalidate?: string;
  /** Called after a successful install (e.g. router.refresh). */
  onInstalled?: () => void;
}

export function PresetPicker({
  open,
  onOpenChange,
  presets,
  title,
  description,
  revalidate,
  onInstalled,
}: Props) {
  const router = useRouter();
  const [installing, setInstalling] = React.useState<string | null>(null);

  function onInstall(preset: ModulePresetView): void {
    const key = `${preset.module}:${preset.slug}`;
    setInstalling(key);
    void (async () => {
      try {
        const res = await installPresetAction(preset.module, preset.slug, revalidate);
        if (res.ok) {
          toast.success(`${preset.name} installed`, {
            description: 'Edit it anytime — it’s yours alone, nothing is shared across tenants.',
          });
          onOpenChange(false);
          onInstalled?.();
          router.refresh();
        } else {
          toast.error("Couldn't install", { description: res.error.message });
        }
      } finally {
        setInstalling(null);
      }
    })();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="2xl">
        <ModalHeader>
          <ModalTitle>{title}</ModalTitle>
          <ModalDescription>{description}</ModalDescription>
        </ModalHeader>
        <Grid cols={1} mdCols={2} lgCols={3} gap={3}>
          {presets.map((preset) => {
            const Icon = ICONS[preset.iconKey] ?? Boxes;
            const key = `${preset.module}:${preset.slug}`;
            return (
              <ModuleProvider
                key={key}
                module={preset.module as SparxModuleName}
                className="h-full"
              >
                <Card variant="subtle" padding="md" className="h-full">
                  <Stack gap={2} className="h-full">
                    <Stack direction="row" gap={2} align="center">
                      <Icon className="text-base-content/60 h-4 w-4" />
                      <Text weight="medium">{preset.name}</Text>
                    </Stack>
                    <Text size="xs" variant="muted" className="flex-1">
                      {preset.description}
                    </Text>
                    <Stack direction="row" gap={1} className="flex-wrap">
                      {preset.summary.map((chip, i) => (
                        <Badge
                          key={`${key}-chip-${i}`}
                          variant="soft"
                          size="sm"
                          {...(chip.tone === 'module' ? { color: 'module' as const } : {})}
                        >
                          {chip.label}
                        </Badge>
                      ))}
                    </Stack>
                    {preset.installed ? (
                      <Badge color="success" variant="soft" size="sm">
                        Installed
                      </Badge>
                    ) : (
                      <Button
                        color="module"
                        size="sm"
                        onClick={() => onInstall(preset)}
                        loading={installing === key}
                        disabled={installing !== null}
                      >
                        Install
                      </Button>
                    )}
                  </Stack>
                </Card>
              </ModuleProvider>
            );
          })}
        </Grid>
      </ModalContent>
    </Modal>
  );
}
