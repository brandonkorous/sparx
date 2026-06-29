'use client';

// The fitment surface's interactive shell: the header actions (Browse the
// dictionary library / build a custom domain), the empty state, and the tree
// editor. Server page fetches the domains + the dictionary catalog and hands
// them down; the overlays drive installs/creates and router.refresh() re-reads.

import * as React from 'react';
import { Boxes, Library, Plus } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  EmptyState,
  Heading,
  Stack,
} from '@sparx/ui';

import type { ModulePresetView } from '../../../_components/preset-actions';
import { PresetPicker } from '../../../_components/preset-picker';
import type { FitmentDomainRow } from '../../fitment-actions';

import { FitmentReferenceEditor } from './fitment-reference-editor';
import { NewDomainDialog } from './new-domain-dialog';

interface Props {
  domains: FitmentDomainRow[];
  presets: ModulePresetView[];
}

export function FitmentManager({ domains, presets }: Props) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [newOpen, setNewOpen] = React.useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <Stack direction="row" align="start" justify="between" gap={3} className="flex-wrap">
            <Stack gap={1}>
              <Heading level={3}>Dictionaries</Heading>
              <CardDescription>
                The compatibility dictionaries your products fit. Install a ready-made one or build
                your own — each is yours to edit. A product&apos;s fitment rule can target any
                depth: just the category (fits any Ford), category + item (an F-250), or all three
                (an F-250 with a 6.7L Power Stroke).
              </CardDescription>
            </Stack>
            <Stack direction="row" gap={2} className="shrink-0">
              <Button
                color="module"
                variant="soft"
                leftIcon={<Library className="h-4 w-4" />}
                onClick={() => setPickerOpen(true)}
              >
                Browse dictionaries
              </Button>
              <Button
                color="module"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => setNewOpen(true)}
              >
                New domain
              </Button>
            </Stack>
          </Stack>
        </CardHeader>
        <CardContent>
          {domains.length === 0 ? (
            <EmptyState
              icon={<Boxes className="h-5 w-5" />}
              title="No fitment dictionaries yet"
              description="Install a ready-made dictionary — vehicles, apparel sizes, devices, pets, and more — or build your own from scratch."
              action={
                <Button
                  color="module"
                  leftIcon={<Library className="h-4 w-4" />}
                  onClick={() => setPickerOpen(true)}
                >
                  Browse dictionaries
                </Button>
              }
            />
          ) : (
            <FitmentReferenceEditor domains={domains} />
          )}
        </CardContent>
      </Card>

      <PresetPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        presets={presets}
        title="Browse fitment dictionaries"
        description="Install a ready-made compatibility dictionary for your industry — vehicles, apparel sizes, devices, pets, and more. Each installs as your own editable tree; nothing is shared across tenants."
        revalidate="/commerce/fitment"
      />
      <NewDomainDialog open={newOpen} onOpenChange={setNewOpen} />
    </>
  );
}
