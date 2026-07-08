'use client';

// The fitment surface's interactive shell: the header actions (Browse the
// dictionary library / build a custom domain), the empty state, and the tree
// editor. Server page fetches the domains + the dictionary catalog and hands
// them down; the overlays drive installs/creates and router.refresh() re-reads.

import * as React from 'react';
import { Boxes, Library, Plus } from 'lucide-react';
import { Button, Card, CardBody, EmptyState } from 'silicaui-react';

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
        <CardBody>
          <div className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-semibold">Dictionaries</h3>
              <p className="opacity-70">
                The compatibility dictionaries your products fit. Install a ready-made one or build
                your own — each is yours to edit. A product&apos;s fitment rule can target any
                depth: just the category (fits any Ford), category + item (an F-250), or all three
                (an F-250 with a 6.7L Power Stroke).
              </p>
            </div>
            <div className="flex shrink-0 flex-row gap-2">
              <Button
                color="module"
                variant="soft"
                iconStart={<Library className="h-4 w-4" />}
                onClick={() => setPickerOpen(true)}
              >
                Browse dictionaries
              </Button>
              <Button
                color="module"
                iconStart={<Plus className="h-4 w-4" />}
                onClick={() => setNewOpen(true)}
              >
                New domain
              </Button>
            </div>
          </div>
          {domains.length === 0 ? (
            <EmptyState
              icon={<Boxes className="h-5 w-5" />}
              title="No fitment dictionaries yet"
              description="Install a ready-made dictionary — vehicles, apparel sizes, devices, pets, and more — or build your own from scratch."
              actions={
                <Button
                  color="module"
                  iconStart={<Library className="h-4 w-4" />}
                  onClick={() => setPickerOpen(true)}
                >
                  Browse dictionaries
                </Button>
              }
            />
          ) : (
            <FitmentReferenceEditor domains={domains} />
          )}
        </CardBody>
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
