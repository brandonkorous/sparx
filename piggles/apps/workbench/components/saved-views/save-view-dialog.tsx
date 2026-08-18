'use client';

// Naming a view.
//
// Shared or private is asked here and almost nowhere else: the distinction
// matters at the moment of saving and rarely afterwards, which is why both kinds
// land in one list rather than behind a "mine / the team's" switch that makes
// people hunt in two places for something they only half remember naming.

import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
  Switch,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { useMutation } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { afterCommit } from '../../lib/defer';
import { normalise, type SavedView, type SavedViewConfig } from './data';

interface SaveViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: string;
  params: Record<string, string>;
  visibleColumns?: string[];
  onSaved: () => void;
}

export function SaveViewDialog({
  open,
  onOpenChange,
  target,
  params,
  visibleColumns,
  onSaved,
}: SaveViewDialogProps) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);

  const create = useMutation({
    mutationFn: (input: {
      target: string;
      name: string;
      config: SavedViewConfig;
      shared: boolean;
      isDefault: boolean;
    }) => api.post<SavedView>('/v1/saved-views', input),
  });

  const save = () => {
    create.mutate(
      {
        target,
        name: name.trim(),
        config: {
          params: {
            ...normalise(params),
            ...(visibleColumns ? { columns: visibleColumns.join(',') } : {}),
          },
        },
        shared,
        isDefault: false,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSaved();
          afterCommit(() => {
            toast.add({ title: 'Saved', type: 'success' });
          });
        },
        onError: () => {
          afterCommit(() => {
            toast.add({
              title: 'Could not save it',
              description: 'A view with that name already exists here.',
              type: 'error',
            });
          });
        },
      }
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setName('');
          setShared(false);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogTitle>Save this view</DialogTitle>
        <DialogDescription>
          What you are looking at right now — the filters, the sort and the columns — kept under a
          name. It saves the question, not the rows, so it stays true as things change.
        </DialogDescription>
        <div className="flex flex-col gap-3 py-2">
          <Field>
            <FieldLabel>Call it</FieldLabel>
            <Input
              color="module"
              value={name}
              placeholder="Running low at the warehouse"
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </Field>
          <Field>
            <FieldLabel>Share it with the team</FieldLabel>
            <Switch
              color="module"
              checked={shared}
              onCheckedChange={(checked) => {
                setShared(checked);
              }}
            />
            <Text className="text-sm">
              {shared
                ? 'Everyone will see it, and anyone can change or delete it.'
                : 'Only you will see it.'}
            </Text>
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <DialogClose>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button color="module" disabled={name.trim() === '' || create.isPending} onClick={save}>
            Save it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
