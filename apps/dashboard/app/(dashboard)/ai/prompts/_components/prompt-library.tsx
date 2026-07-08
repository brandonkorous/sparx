'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { toast, useConfirm } from '@sparx/ui';
import { Badge, Button, Card, CardBody, EmptyState } from 'silicaui-react';

import { deletePromptAction, installDefaultPromptsAction } from '../actions';
import {
  CATEGORY_ORDER,
  PROMPT_CATEGORIES,
  categoryLabel,
  type PromptCategory,
  type PromptTemplateDto,
} from './prompt-types';
import { PromptForm } from './prompt-form';

// The prompt library client surface: prompts grouped by category (persona
// first), each row carrying its badges (category, sample, disabled, model) +
// declared-variable chips + a body preview, with create / edit / delete wired
// to the server actions. Zero prompts shows the install-defaults hero.

interface PromptLibraryProps {
  prompts: PromptTemplateDto[];
}

const categoryBlurb = (c: PromptCategory): string =>
  PROMPT_CATEGORIES.find((entry) => entry.value === c)?.blurb ?? '';

export function PromptLibrary({ prompts }: PromptLibraryProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PromptTemplateDto | null>(null);
  const [installing, startInstall] = React.useTransition();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  function openCreate(): void {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(template: PromptTemplateDto): void {
    setEditing(template);
    setFormOpen(true);
  }

  function installDefaults(): void {
    startInstall(async () => {
      const res = await installDefaultPromptsAction();
      if (!res.ok) {
        toast.error('Couldn’t install the starter library', { description: res.error.message });
        return;
      }
      toast.success(
        res.data.added > 0
          ? `Installed ${res.data.added} starter prompt${res.data.added === 1 ? '' : 's'}`
          : 'Your library already has the starter prompts'
      );
      router.refresh();
    });
  }

  function onDelete(template: PromptTemplateDto): void {
    void (async () => {
      const ok = await confirm({
        title: `Delete “${template.name}”?`,
        description:
          'This removes the prompt from your library. Flows that reference it will fall back to their default. This can’t be undone.',
        confirmLabel: 'Delete prompt',
        tone: 'danger',
      });
      if (!ok) return;
      setDeletingId(template.id);
      try {
        const res = await deletePromptAction(template.id);
        if (!res.ok) {
          toast.error('Couldn’t delete the prompt', { description: res.error.message });
          return;
        }
        toast.success('Prompt deleted');
        router.refresh();
      } finally {
        setDeletingId(null);
      }
    })();
  }

  // Group into the closed category order, persona first; only render non-empty
  // sections so the page is all signal.
  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: prompts.filter((p) => p.category === category),
  })).filter((g) => g.items.length > 0);

  const form = (
    <PromptForm
      open={formOpen}
      onOpenChange={setFormOpen}
      template={editing}
      onSaved={() => router.refresh()}
    />
  );

  if (prompts.length === 0) {
    return (
      <>
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="No prompts yet"
          description="Install the platform starter library to get a tuned prompt for support, email, product, SEO, and a chat persona — or write your own from scratch."
          actions={
            <>
              <Button
                color="module"
                iconStart={<Sparkles className="h-4 w-4" />}
                onClick={installDefaults}
                loading={installing}
                disabled={installing}
              >
                Install the starter library
              </Button>
              <Button variant="outline" color="module" onClick={openCreate} disabled={installing}>
                Create a prompt
              </Button>
            </>
          }
        />
        {form}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-row flex-wrap items-center justify-between gap-3">
        <p className="text-base-content/70 text-sm">
          {prompts.length} prompt{prompts.length === 1 ? '' : 's'} across {grouped.length} categor
          {grouped.length === 1 ? 'y' : 'ies'}.
        </p>
        <Button color="module" iconStart={<Plus className="h-4 w-4" />} onClick={openCreate}>
          New prompt
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-6">
        {grouped.map(({ category, items }) => (
          <section key={category}>
            <div className="mb-3 flex flex-col gap-1">
              <div className="flex flex-row items-center gap-2">
                <p className="font-medium">{categoryLabel(category)}</p>
                <Badge variant="soft" size="sm">
                  {items.length}
                </Badge>
              </div>
              <p className="text-base-content/70 text-xs">{categoryBlurb(category)}</p>
            </div>
            <div className="flex flex-col gap-3">
              {items.map((prompt) => (
                <PromptRow
                  key={prompt.id}
                  prompt={prompt}
                  deleting={deletingId === prompt.id}
                  onEdit={() => openEdit(prompt)}
                  onDelete={() => onDelete(prompt)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {form}
    </>
  );
}

interface PromptRowProps {
  prompt: PromptTemplateDto;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function PromptRow({ prompt, deleting, onEdit, onDelete }: PromptRowProps) {
  return (
    <Card>
      <CardBody className="p-4">
        <div className="flex flex-row flex-wrap items-start gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-row flex-wrap items-center gap-2">
              <p className="truncate font-medium">{prompt.name}</p>
              <Badge color="module" variant="soft" size="sm">
                {categoryLabel(prompt.category)}
              </Badge>
              {prompt.isSample && (
                <Badge variant="soft" size="sm">
                  Sample
                </Badge>
              )}
              {!prompt.enabled && (
                <Badge color="neutral" variant="outline" size="sm">
                  Disabled
                </Badge>
              )}
              {prompt.model && (
                <Badge color="info" variant="soft" size="sm">
                  {prompt.model}
                </Badge>
              )}
            </div>

            {prompt.description && (
              <p className="text-base-content/70 text-sm">{prompt.description}</p>
            )}

            <p className="bg-base-200 text-base-content/70 line-clamp-2 rounded-md px-3 py-2 font-mono text-xs leading-relaxed">
              {prompt.body}
            </p>

            {prompt.variables.length > 0 && (
              <div className="flex flex-row flex-wrap gap-1">
                {prompt.variables.map((variable) => (
                  <Badge key={variable.key} variant="outline" color="module" size="sm">
                    {`{{${variable.key}}}`}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-row gap-1">
            <Button
              variant="ghost"
              color="module"
              size="sm"
              shape="square"
              aria-label={`Edit ${prompt.name}`}
              title="Edit prompt"
              onClick={onEdit}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              color="danger"
              size="sm"
              shape="square"
              aria-label={`Delete ${prompt.name}`}
              title="Delete prompt"
              onClick={onDelete}
              loading={deleting}
              disabled={deleting}
            >
              {!deleting && <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
