'use client';

// Pipeline header editor — name + default flag + archive action.
// Slug is immutable because the URL identifier should stay stable.

import * as React from 'react';
import { Archive } from 'lucide-react';

import { Button, Card, CardBody, CardTitle, Checkbox, Input, Label } from 'silicaui-react';

export interface PipelineHeader {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  archivedAt: string | null;
}

interface PipelineHeaderCardProps {
  pipeline: PipelineHeader;
  onSave: (input: { name?: string; isDefault?: boolean }) => void;
  onArchive: () => void;
  pending: boolean;
}

export function PipelineHeaderCard({
  pipeline,
  onSave,
  onArchive,
  pending,
}: PipelineHeaderCardProps) {
  const [name, setName] = React.useState(pipeline.name);
  const [isDefault, setIsDefault] = React.useState(pipeline.isDefault);
  const dirty = name !== pipeline.name || isDefault !== pipeline.isDefault;

  return (
    <Card>
      <CardBody>
        <CardTitle>Header</CardTitle>
        <div className="flex flex-col gap-4">
          <div className="flex flex-row gap-4">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex w-64 flex-col gap-2">
              <Label>Slug</Label>
              <Input value={pipeline.slug} disabled />
              <p className="text-base-content/70 text-xs">Slug is immutable to keep URLs stable.</p>
            </div>
          </div>
          <div className="flex flex-row items-center gap-2">
            <Checkbox
              color="module"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              id="isDefault-edit"
            />
            <Label htmlFor="isDefault-edit">Default pipeline</Label>
          </div>
          <div className="flex flex-row gap-2">
            <Button
              color="module"
              size="sm"
              disabled={!dirty || pending}
              onClick={() => onSave({ name, isDefault })}
            >
              Save header
            </Button>
            {!pipeline.archivedAt && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onArchive}
                disabled={pending}
                iconStart={<Archive className="h-3.5 w-3.5" />}
              >
                Archive pipeline
              </Button>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
