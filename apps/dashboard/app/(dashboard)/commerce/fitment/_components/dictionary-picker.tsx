'use client';

// Browse the platform's fitment-dictionary library and install one as a
// tenant-scoped tree. Mirrors the blueprint install UX (action → toast →
// router.refresh). A dictionary whose slug the tenant already uses shows
// "Installed" instead of an install button (the API would 409 on a re-install).
//
// The modal renders in a Radix portal (document.body), which is OUTSIDE the
// commerce route's <ModuleProvider> — so `--module-active` would fall back to
// :root indigo. We re-wrap the content in <ModuleProvider module="commerce">
// so the module-colored install buttons render Commerce orange (the portal
// footgun in packages/ui/CLAUDE.md).

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

import type { FitmentDictionarySummary } from '../../fitment-actions';
import { installFitmentDictionaryAction } from '../../fitment-actions';
import { pluralizeLabel } from './pluralize';

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
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dictionaries: FitmentDictionarySummary[];
  /** Slugs the tenant already has — rendered as "Installed", not installable. */
  installedSlugs: string[];
}

export function DictionaryPicker({ open, onOpenChange, dictionaries, installedSlugs }: Props) {
  const router = useRouter();
  const [installing, setInstalling] = React.useState<string | null>(null);
  const installed = new Set(installedSlugs);

  function onInstall(dict: FitmentDictionarySummary): void {
    setInstalling(dict.slug);
    void (async () => {
      try {
        const res = await installFitmentDictionaryAction(dict.slug);
        if (res.ok) {
          toast.success(`${dict.name} installed`, {
            description: 'Edit its categories, items, and variants anytime.',
          });
          onOpenChange(false);
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
        <ModuleProvider module="commerce">
          <ModalHeader>
            <ModalTitle>Browse fitment dictionaries</ModalTitle>
            <ModalDescription>
              Install a ready-made compatibility dictionary for your industry — vehicles, apparel
              sizes, devices, pets, and more. Each installs as your own editable tree; nothing is
              shared across tenants.
            </ModalDescription>
          </ModalHeader>
          <Grid cols={1} mdCols={2} lgCols={3} gap={3}>
            {dictionaries.map((dict) => {
              const Icon = ICONS[dict.iconKey] ?? Boxes;
              const isInstalled = installed.has(dict.slug);
              return (
                <Card key={dict.slug} variant="subtle" padding="md">
                  <Stack gap={2} className="h-full">
                    <Stack direction="row" gap={2} align="center">
                      <Icon className="h-4 w-4 text-[var(--color-text-muted)]" />
                      <Text weight="medium">{dict.name}</Text>
                    </Stack>
                    <Text size="xs" variant="muted" className="flex-1">
                      {dict.description}
                    </Text>
                    <Stack direction="row" gap={1} className="flex-wrap">
                      <Badge variant="soft" size="sm">
                        {levelChain(dict)}
                      </Badge>
                      <Badge color="module" variant="soft" size="sm">
                        {dict.rootCount} {labelL1(dict)}
                      </Badge>
                    </Stack>
                    {isInstalled ? (
                      <Badge color="success" variant="soft" size="sm">
                        Installed
                      </Badge>
                    ) : (
                      <Button
                        color="module"
                        size="sm"
                        onClick={() => onInstall(dict)}
                        loading={installing === dict.slug}
                        disabled={installing !== null}
                      >
                        Install
                      </Button>
                    )}
                  </Stack>
                </Card>
              );
            })}
          </Grid>
        </ModuleProvider>
      </ModalContent>
    </Modal>
  );
}

function labelL1(dict: FitmentDictionarySummary): string {
  const first = dict.dimensions.find((d) => d.kind === 'level');
  return pluralizeLabel((first?.label ?? 'item').toLowerCase(), dict.rootCount);
}

// The level chain plus any range axes, e.g. "Make → Model → Engine · Year".
function levelChain(dict: FitmentDictionarySummary): string {
  const levels = dict.dimensions
    .filter((d) => d.kind === 'level')
    .map((d) => d.label)
    .join(' → ');
  const ranges = dict.dimensions
    .filter((d) => d.kind === 'range')
    .map((d) => d.label)
    .join(', ');
  return ranges ? `${levels} · ${ranges}` : levels;
}
