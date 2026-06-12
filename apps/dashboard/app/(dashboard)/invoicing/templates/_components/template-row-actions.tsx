'use client';

// Row actions for a print template: preview (opens the rendered HTML in a new
// tab), publish the draft, make it the tenant default, and delete. The default
// template can't be deleted (the §10 fallback guarantee) — the service rejects it
// and we surface the message.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Eye, MoreHorizontal, Star, Trash2 } from 'lucide-react';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Stack,
  Text,
  useConfirm,
} from '@sparx/ui';

import {
  publishTemplateAction,
  removeTemplateAction,
  setDefaultTemplateAction,
} from '../../template-actions';

interface Props {
  id: string;
  name: string;
  isDefault: boolean;
  published: boolean;
}

export function TemplateRowActions({ id, name, isDefault, published }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) {
        setError(res.error?.message ?? 'Something went wrong');
        return;
      }
      router.refresh();
    });
  }

  async function onDelete() {
    const ok = await confirm({
      title: `Delete “${name}”?`,
      description: 'This print template will be removed. This cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    run(() => removeTemplateAction(id));
  }

  return (
    <Stack direction="row" align="center" justify="end" gap={2}>
      {error && (
        <Text size="xs" variant="danger" role="alert">
          {error}
        </Text>
      )}
      <Button
        asChild
        variant="ghost"
        size="sm"
        leftIcon={<Eye className="h-3.5 w-3.5" />}
        disabled={pending}
      >
        <a href={`/invoicing/templates/${id}/preview`} target="_blank" rel="noreferrer">
          Preview
        </a>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" shape="square" disabled={pending} aria-label="More">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => run(() => publishTemplateAction(id))}>
            <CheckCircle className="mr-2 h-4 w-4" />
            {published ? 'Re-publish draft' : 'Publish'}
          </DropdownMenuItem>
          {!isDefault && (
            <DropdownMenuItem onSelect={() => run(() => setDefaultTemplateAction(id))}>
              <Star className="mr-2 h-4 w-4" />
              Make default
            </DropdownMenuItem>
          )}
          {!isDefault && (
            <DropdownMenuItem onSelect={() => void onDelete()}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </Stack>
  );
}
