'use client';

// Adding one redirect.
//
// A modal, and one that earns it: two paths and a permanent/temporary choice,
// over in seconds, with nothing durable to return to afterwards — a redirect has
// no manage surface, it only ever exists in the list. Abandoning it costs at most
// retyping two short fields. Bulk import, which is multi-line paste with real
// work to lose, is a pane instead.

import { useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { PaneScope } from '../../lib/dock/window-boundary';
import { afterPaneChange } from '../../lib/defer';
import {
  normalizePath,
  redirectErrorMessage,
  redirectTypeMeta,
  useCreateRedirect,
} from './redirects-data';

export function AddRedirectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const toast = useToast();
  const create = useCreateRedirect();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [permanent, setPermanent] = useState(true);

  const close = () => {
    onOpenChange(false);
    setFrom('');
    setTo('');
    setPermanent(true);
    create.reset();
  };

  const fromPath = normalizePath(from);
  const toPath = normalizePath(to);
  const sameAddress = fromPath !== '' && fromPath === toPath;
  const canSubmit = fromPath !== '' && toPath !== '' && !sameAddress && !create.isPending;

  const submit = () => {
    if (!canSubmit) return;
    create.mutate(
      { from_path: fromPath, to_path: toPath, status_code: permanent ? 301 : 302 },
      {
        onSuccess: () => {
          close();
          afterPaneChange(() => {
            toast.add({
              title: 'Redirect added',
              description: `Anyone visiting ${fromPath} now lands on ${toPath}.`,
              type: 'success',
            });
          });
        },
      }
    );
  };

  // A failure names the exact problem — a duplicate, a loop, a rule pointing at
  // itself — in the dialog rather than a toast that vanishes mid-read.
  const failure = create.isError
    ? redirectErrorMessage(create.error, 'Could not add that redirect. Nothing was changed.')
    : null;

  return (
    <PaneScope>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        <DialogContent className="flex max-h-[calc(100%-2rem)] max-w-lg flex-col overflow-hidden">
          <DialogTitle>Add a redirect</DialogTitle>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2">
            {failure ? (
              <Alert color="error" variant="soft">
                <AlertContent>
                  <AlertTitle>Could not add that redirect</AlertTitle>
                  <AlertDescription>{failure}</AlertDescription>
                </AlertContent>
              </Alert>
            ) : null}

            <Field>
              <FieldLabel required>Old address</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    value={from}
                    placeholder="/old-pricing"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) => {
                      setFrom(event.target.value);
                    }}
                  />
                }
              />
              <FieldDescription>
                The address people are still using — the one you want to catch. Just the part after
                your domain, starting with a slash.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel required>Send them to</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    value={to}
                    placeholder="/pricing"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) => {
                      setTo(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') submit();
                    }}
                  />
                }
              />
              <FieldDescription>
                Where the old address should take them instead — another page on this same site.
              </FieldDescription>
            </Field>

            {sameAddress ? (
              <Text className="text-sm">
                The old and new addresses are the same — send visitors somewhere different.
              </Text>
            ) : null}

            <Field>
              <FieldLabel>Is this move permanent?</FieldLabel>
              <NativeSelect
                color="module"
                aria-label="Is this move permanent?"
                value={permanent ? 'permanent' : 'temporary'}
                onChange={(event) => {
                  setPermanent(event.target.value === 'permanent');
                }}
              >
                <option value="permanent">Permanent — the page has moved for good</option>
                <option value="temporary">Temporary — it will move back later</option>
              </NativeSelect>
              <FieldDescription>{redirectTypeMeta(permanent ? 301 : 302).detail}</FieldDescription>
            </Field>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button
              color="module"
              size="sm"
              loading={create.isPending}
              disabled={!canSubmit}
              onClick={submit}
            >
              Add redirect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}
