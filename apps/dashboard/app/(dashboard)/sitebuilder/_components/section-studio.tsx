'use client';

// Section Studio editor (docs/38 Phase C; docs/handoffs/sitebuilder-section-studio-design.md).
// Authors a custom section TYPE: identity (slug/label/binding/...), the field
// spec (the inspector form), and the render-template AST. Left column authors,
// right column previews. Full-width in the editor shell.
//
// This file owns the working-state + save/delete; the field-spec editor, the
// dual template editor (visual + JSON), and the live preview mount into the
// marked slots (built up across the Studio increments).

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  Input,
  Label,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@sparx/ui';
import { ArrowLeft, Blocks, Trash2 } from 'lucide-react';
import {
  SectionTemplate,
  validateTemplate,
  type SectionField,
  type TemplateNode,
} from '@sparx/sitebuilder-schemas';
import {
  createDefinition,
  deleteDefinition,
  updateDefinition,
  type DefinitionInput,
} from '../_lib/actions';
import type { CustomDefinitionDto } from '../_lib/types';
import { FieldSpecEditor } from './field-spec-editor';
import { FieldControl } from './field-control';
import { SectionPreview } from './section-preview';
import { TemplateBuilder } from './template-builder';

type Binding = 'none' | 'product' | 'collection';

// A fresh definition starts from an empty Stack — the author composes it in the
// template editor. Empty field spec; no binding.
const EMPTY_TEMPLATE: TemplateNode = { type: 'Stack', children: [] };

export interface SectionStudioProps {
  mode: 'create' | 'edit';
  definition?: CustomDefinitionDto;
}

export function SectionStudio({ mode, definition }: SectionStudioProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  // Identity
  const [slug, setSlug] = React.useState(definition?.slug ?? '');
  const [label, setLabel] = React.useState(definition?.label ?? '');
  const [description, setDescription] = React.useState(definition?.description ?? '');
  const [icon, setIcon] = React.useState(definition?.icon ?? '');
  const [binding, setBinding] = React.useState<Binding>(definition?.binding ?? 'none');

  const bindingValue: 'product' | 'collection' | null = binding === 'none' ? null : binding;

  const [fieldSpec, setFieldSpec] = React.useState<SectionField[]>(definition?.fieldSpec ?? []);
  // The render template AST is the single source of truth — the builder edits it
  // visually or as JSON. `jsonError` is true while the JSON view holds an
  // uncommitted/invalid draft, which must block Save.
  const [template, setTemplate] = React.useState<TemplateNode>(
    () => definition?.template ?? EMPTY_TEMPLATE
  );
  const [jsonError, setJsonError] = React.useState(false);

  // Semantic validity (gates Save) + shape validity (gates the live preview, which
  // tolerates semantic gaps — an unresolved bind just renders empty).
  const issues = React.useMemo(
    () => validateTemplate(template, { fieldSpec, binding: bindingValue }),
    [template, fieldSpec, bindingValue]
  );
  const templateValid = issues.length === 0;
  const shapeValid = React.useMemo(() => SectionTemplate.safeParse(template).success, [template]);

  const isEdit = mode === 'edit';
  const canSave =
    slug.trim().length > 0 && label.trim().length > 0 && templateValid && !jsonError && !pending;

  const save = () => {
    setError(null);
    if (!templateValid) {
      setError('Fix the template before saving.');
      return;
    }
    const body: Omit<DefinitionInput, 'slug'> = {
      label: label.trim(),
      description: description.trim() || undefined,
      icon: icon.trim() || undefined,
      binding: bindingValue,
      fieldSpec,
      template,
    };
    startTransition(async () => {
      const res = isEdit
        ? await updateDefinition(definition!.slug, body)
        : await createDefinition({ slug: slug.trim(), ...body });
      if (!res.ok) {
        setError(res.error ?? 'Could not save the section.');
        return;
      }
      router.push('/sitebuilder/sections');
      router.refresh();
    });
  };

  const remove = () => {
    if (!isEdit) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteDefinition(definition!.slug);
      if (!res.ok) {
        setError(res.error ?? 'Could not delete the section.');
        return;
      }
      router.push('/sitebuilder/sections');
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <button
        type="button"
        onClick={() => router.push('/sitebuilder/sections')}
        className="flex items-center gap-1 self-start text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Sections
      </button>

      <PageHeader
        icon={<Blocks className="h-5 w-5" />}
        title={isEdit ? label || 'Edit section' : 'New section'}
        description={
          isEdit
            ? `custom:${definition?.slug} · v${definition?.version}`
            : 'Define a reusable custom section type.'
        }
        actions={
          <div className="flex items-center gap-2">
            {isEdit ? (
              <Button variant="ghost" onClick={remove} disabled={pending}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            ) : null}
            <Button onClick={save} disabled={!canSave}>
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create section'}
            </Button>
          </div>
        }
      />

      {error ? (
        <Card variant="default" className="border-[var(--color-danger)] p-3">
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Authoring column */}
        <div className="flex flex-col gap-4">
          {/* Identity */}
          <Card variant="module" className="flex flex-col gap-4 p-4">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Identity</h2>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sec-slug">Slug</Label>
              <Input
                id="sec-slug"
                value={slug}
                disabled={isEdit}
                placeholder="icon-grid"
                onChange={(e) => setSlug(e.target.value)}
              />
              <p className="text-xs text-[var(--color-text-muted)]">
                Lowercase kebab-case. Placed as{' '}
                <span className="font-mono">custom:{slug || 'your-slug'}</span>
                {isEdit ? ' (can’t change after creation).' : '.'}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sec-label">Label</Label>
              <Input
                id="sec-label"
                value={label}
                placeholder="Icon grid"
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sec-desc">Description</Label>
              <Textarea
                id="sec-desc"
                rows={2}
                value={description}
                placeholder="A responsive grid of icon + title features."
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sec-icon">Icon</Label>
                <Input
                  id="sec-icon"
                  value={icon}
                  placeholder="lucide name, e.g. grid-3x3"
                  onChange={(e) => setIcon(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sec-binding">Binding</Label>
                <Select value={binding} onValueChange={(v) => setBinding(v as Binding)}>
                  <SelectTrigger id="sec-binding">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (static)</SelectItem>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="collection">Collection</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Fields — the inspector form spec a placed section is edited with. */}
          <Card variant="module" className="flex flex-col gap-3 p-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Fields</h2>
              <p className="text-xs text-[var(--color-text-muted)]">
                The editable settings you fill in when you place this section.
              </p>
            </div>
            <FieldSpecEditor value={fieldSpec} onChange={setFieldSpec} />
          </Card>

          {/* Template — the render AST, edited visually or as JSON over one tree. */}
          <Card variant="module" className="flex flex-col gap-3 p-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Template</h2>
              <p className="text-xs text-[var(--color-text-muted)]">
                The component tree this section renders. Bind text and media to fields.
              </p>
            </div>
            <TemplateBuilder
              value={template}
              onChange={setTemplate}
              fieldSpec={fieldSpec}
              binding={bindingValue}
              onJsonErrorChange={setJsonError}
            />
          </Card>
        </div>

        {/* Preview column. Two views over the same authored state: the live
            RENDER (the template against sample content, via the storefront's own
            interpreter) and the inspector FORM the field spec generates. Sticky
            so it stays in view while the authoring column scrolls. */}
        <Card
          variant="default"
          className="flex min-h-64 flex-col gap-3 p-4 lg:sticky lg:top-4 lg:self-start"
        >
          <Tabs defaultValue="render" className="flex flex-col gap-3">
            <TabsList>
              <TabsTrigger value="render">Preview</TabsTrigger>
              <TabsTrigger value="form">Form</TabsTrigger>
            </TabsList>
            <TabsContent value="render" className="flex flex-col gap-3">
              <p className="text-xs text-[var(--color-text-muted)]">
                How this section renders with sample content, in the default theme.
              </p>
              <SectionPreview
                node={shapeValid ? template : null}
                fieldSpec={fieldSpec}
                binding={bindingValue}
              />
            </TabsContent>
            <TabsContent value="form" className="flex flex-col gap-3">
              <p className="text-xs text-[var(--color-text-muted)]">
                The settings form you fill in when placing this section.
              </p>
              <FormPreview fields={fieldSpec} />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

// Renders the inspector form a custom section produces, by mapping its field spec
// through the same FieldControl the live editor uses. Local state — preview only.
function FormPreview({ fields }: { fields: SectionField[] }) {
  const [config, setConfig] = React.useState<Record<string, unknown>>({});
  if (fields.length === 0) {
    return (
      <p className="text-xs text-[var(--color-text-muted)]">
        Add fields to preview the inspector form.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {fields.map((field, i) => (
        <FieldControl
          key={field.key || `f-${i}`}
          field={field}
          value={config[field.key]}
          onChange={(v) => setConfig((c) => ({ ...c, [field.key]: v }))}
        />
      ))}
    </div>
  );
}
