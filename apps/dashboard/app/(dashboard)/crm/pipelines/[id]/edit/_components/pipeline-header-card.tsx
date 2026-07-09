'use client';

// Pipeline header editor — name + default flag + archive action.
// Slug is immutable because the URL identifier should stay stable.

import * as React from 'react';
import { Archive } from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  CardTitle,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Label,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';

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

  const v = useFieldValidation({ name }, { name: rule.required('Name is required.') });

  return (
    <Card>
      <CardBody>
        <CardTitle>Header</CardTitle>
        <div className="flex flex-col gap-4">
          <div className="flex flex-row gap-4">
            <Field {...v.field('name')} className="flex-1">
              <FieldLabel required>Name</FieldLabel>
              <FieldControl
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                {...v.control('name')}
              />
            </Field>
            <Field className="w-64">
              <FieldLabel>Slug</FieldLabel>
              <FieldControl name="slug" value={pipeline.slug} disabled />
              <FieldDescription>Slug is immutable to keep URLs stable.</FieldDescription>
            </Field>
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
              onClick={() => {
                if (!v.validate()) return;
                onSave({ name, isDefault });
              }}
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
