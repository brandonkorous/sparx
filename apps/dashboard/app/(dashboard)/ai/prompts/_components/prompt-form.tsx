'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  Drawer,
  DrawerContent,
  Input,
  Label,
  ModuleProvider,
  NativeSelect,
  Stack,
  Switch,
  SurfaceFrame,
  SurfaceStep,
  Text,
  Textarea,
  toast,
  useConfirm,
  type SurfaceStepDef,
} from '@sparx/ui';

import {
  createPromptAction,
  updatePromptAction,
  type CreatePromptInput,
  type UpdatePromptInput,
} from '../actions';
import {
  PROMPT_CATEGORIES,
  isValidPromptKey,
  suggestKey,
  type PromptCategory,
  type PromptTemplateDto,
  type PromptVariable,
} from './prompt-types';
import { VariableRepeater } from './variable-repeater';

// Create / edit a prompt template on the standard form surface (docs/86 F
// layout) hosted in a right-side drawer. The SAME component serves both flows:
// `template == null` creates (key is editable + kebab-validated), an existing
// template edits (key is locked — the backend forbids changing it). Fields sit
// in neutral cards (single-module surface — identity rides the rose chrome +
// Save button); the frame owns the pinned Cancel/Save toolbar.

const STEPS: SurfaceStepDef[] = [{ key: 'basics', label: 'Prompt' }];

interface PromptFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null → create; a template → edit. */
  template: PromptTemplateDto | null;
  onSaved: () => void;
}

export function PromptForm({ open, onOpenChange, template, onSaved }: PromptFormProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        side="right"
        hideClose
        className="w-full max-w-2xl p-0 sm:max-w-2xl"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Remount on target change so the controlled fields reset cleanly
            between a create and each edit. */}
        {open && (
          <PromptFormBody
            key={template?.id ?? 'new'}
            template={template}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}

interface PromptFormBodyProps {
  template: PromptTemplateDto | null;
  onClose: () => void;
  onSaved: () => void;
}

function PromptFormBody({ template, onClose, onSaved }: PromptFormBodyProps) {
  const isEdit = template != null;
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const [key, setKey] = React.useState(template?.key ?? '');
  const [keyTouched, setKeyTouched] = React.useState(isEdit);
  const [name, setName] = React.useState(template?.name ?? '');
  const [description, setDescription] = React.useState(template?.description ?? '');
  const [category, setCategory] = React.useState<PromptCategory>(template?.category ?? 'general');
  const [body, setBody] = React.useState(template?.body ?? '');
  const [model, setModel] = React.useState(template?.model ?? '');
  const [enabled, setEnabled] = React.useState(template?.enabled ?? true);
  const [variables, setVariables] = React.useState<PromptVariable[]>(template?.variables ?? []);

  // Auto-derive the key from the name until the user edits the key directly
  // (create only — an edit never sends key).
  function onNameChange(value: string): void {
    setName(value);
    if (!isEdit && !keyTouched) setKey(suggestKey(value));
  }

  const dirty = isEdit
    ? name !== template.name ||
      (description ?? '') !== (template.description ?? '') ||
      category !== template.category ||
      body !== template.body ||
      (model ?? '') !== (template.model ?? '') ||
      enabled !== template.enabled ||
      JSON.stringify(variables) !== JSON.stringify(template.variables)
    : key.trim() !== '' ||
      name.trim() !== '' ||
      description.trim() !== '' ||
      body.trim() !== '' ||
      model.trim() !== '' ||
      variables.length > 0;

  // Guard a discard — the drawer's own Cancel and its backdrop/Esc both route
  // here so typed work isn't silently dropped.
  async function guardedClose(): Promise<void> {
    if (dirty) {
      const ok = await confirm({
        title: isEdit ? 'Discard your changes?' : 'Discard this prompt?',
        description: 'Your edits to this prompt haven’t been saved. Leaving will discard them.',
        confirmLabel: 'Discard',
        tone: 'danger',
      });
      if (!ok) return;
    }
    onClose();
  }

  function cleanVariables(): PromptVariable[] {
    return variables
      .map((v) => ({
        key: v.key.trim(),
        label: v.label.trim(),
        ...(v.example?.trim() ? { example: v.example.trim() } : {}),
      }))
      .filter((v) => v.key !== '' && v.label !== '');
  }

  function validate(): boolean {
    const fe: Record<string, string> = {};
    if (!name.trim()) fe.name = 'Name is required.';
    if (!body.trim()) fe.body = 'A prompt body is required.';
    if (!isEdit) {
      if (!key.trim()) fe.key = 'A key is required.';
      else if (!isValidPromptKey(key.trim()))
        fe.key = 'Use lowercase letters, numbers, and hyphens (e.g. support-greeting).';
    }
    setFieldErrors(fe);
    return Object.keys(fe).length === 0;
  }

  function submit(): void {
    setError(null);
    if (!validate()) return;

    startTransition(async () => {
      if (isEdit) {
        const patch: UpdatePromptInput = {
          name: name.trim(),
          description: description.trim() ? description.trim() : null,
          category,
          body,
          variables: cleanVariables(),
          model: model.trim() ? model.trim() : null,
          enabled,
        };
        const res = await updatePromptAction(template.id, patch);
        if (!res.ok) {
          setError(res.error.message);
          return;
        }
        toast.success('Prompt updated');
      } else {
        const payload: CreatePromptInput = {
          key: key.trim(),
          name: name.trim(),
          category,
          body,
          enabled,
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(model.trim() ? { model: model.trim() } : {}),
          ...(cleanVariables().length ? { variables: cleanVariables() } : {}),
        };
        const res = await createPromptAction(payload);
        if (!res.ok) {
          if (res.error.code === 'CONFLICT') {
            setFieldErrors({ key: 'That key is already in use — pick another.' });
          }
          setError(res.error.message);
          return;
        }
        toast.success('Prompt created');
      }
      onSaved();
      onClose();
    });
  }

  return (
    <ModuleProvider module="ai" className="h-full">
      <SurfaceFrame
        variant="inline"
        title={isEdit ? 'Edit prompt' : 'New prompt'}
        steps={STEPS}
        current={0}
        onCancel={() => void guardedClose()}
      >
        <SurfaceStep
          header={{
            title: isEdit ? 'Edit prompt' : 'New prompt',
            supporting:
              category === 'persona'
                ? 'A persona prompt sets the voice your chat assistant speaks in — enable one to ground every reply.'
                : 'Reusable AI prompts your flows can call. Wrap any fill-in value in {{double braces}} and declare it below.',
          }}
          actions={{
            onNext: submit,
            nextLabel: isEdit ? 'Save changes' : 'Create prompt',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <Card variant="default">
            <CardContent className="py-6">
              <Stack gap={5}>
                <Stack direction="row" gap={3} wrap>
                  <Stack gap={2} className="min-w-[12rem] flex-1">
                    <Label htmlFor="prompt-name">Name</Label>
                    <Input
                      id="prompt-name"
                      value={name}
                      onChange={(e) => onNameChange(e.target.value)}
                      placeholder="Support greeting"
                      variant={fieldErrors.name ? 'error' : 'default'}
                    />
                    {fieldErrors.name && (
                      <Text size="xs" variant="danger">
                        {fieldErrors.name}
                      </Text>
                    )}
                  </Stack>
                  <Stack gap={2} className="min-w-[12rem] flex-1">
                    <Label htmlFor="prompt-category">Category</Label>
                    <NativeSelect
                      id="prompt-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as PromptCategory)}
                    >
                      {PROMPT_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </Stack>
                </Stack>

                {!isEdit && (
                  <Stack gap={2}>
                    <Label htmlFor="prompt-key">Key</Label>
                    <Input
                      id="prompt-key"
                      value={key}
                      onChange={(e) => {
                        setKeyTouched(true);
                        setKey(e.target.value);
                      }}
                      placeholder="support-greeting"
                      variant={fieldErrors.key ? 'error' : 'default'}
                    />
                    {fieldErrors.key ? (
                      <Text size="xs" variant="danger">
                        {fieldErrors.key}
                      </Text>
                    ) : (
                      <Text size="xs" variant="muted">
                        A stable, lowercase identifier your flows reference. It can’t change later.
                      </Text>
                    )}
                  </Stack>
                )}

                <Stack gap={2}>
                  <Label htmlFor="prompt-description">Description (optional)</Label>
                  <Input
                    id="prompt-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="A warm first reply for new support conversations."
                  />
                </Stack>

                <Stack gap={2}>
                  <Label htmlFor="prompt-body">Body</Label>
                  <Textarea
                    id="prompt-body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={8}
                    className="font-mono text-[0.8125rem] leading-relaxed"
                    placeholder={
                      'You are a friendly assistant for {{store_name}}. Greet {{customer_name}} and offer help.'
                    }
                    variant={fieldErrors.body ? 'error' : 'default'}
                  />
                  {fieldErrors.body ? (
                    <Text size="xs" variant="danger">
                      {fieldErrors.body}
                    </Text>
                  ) : (
                    <Text size="xs" variant="muted">
                      Wrap fill-in values in <code>{'{{double braces}}'}</code> — the consuming flow
                      substitutes them at call time.
                    </Text>
                  )}
                </Stack>

                <Stack gap={2}>
                  <Label htmlFor="prompt-model">Model override (optional)</Label>
                  <Input
                    id="prompt-model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Inherit the tenant default"
                  />
                  <Text size="xs" variant="muted">
                    Pin a specific model for this prompt, or leave blank to use the tenant default.
                  </Text>
                </Stack>

                <Stack direction="row" align="center" gap={3}>
                  <Switch
                    id="prompt-enabled"
                    color="module"
                    checked={enabled}
                    onCheckedChange={setEnabled}
                  />
                  <Stack gap={1}>
                    <Label htmlFor="prompt-enabled">Enabled</Label>
                    <Text size="xs" variant="muted">
                      {category === 'persona'
                        ? 'Only the active enabled persona grounds the chat assistant.'
                        : 'Disabled prompts stay in the library but won’t be offered to flows.'}
                    </Text>
                  </Stack>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="default" className="mt-4">
            <CardContent className="py-6">
              <VariableRepeater variables={variables} onChange={setVariables} />
            </CardContent>
          </Card>

          {error && (
            <Text size="sm" variant="danger" role="alert" aria-live="polite" className="mt-4">
              {error}
            </Text>
          )}
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
