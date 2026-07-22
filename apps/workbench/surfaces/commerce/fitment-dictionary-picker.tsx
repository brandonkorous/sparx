'use client';

// Install a ready-made compatibility list.
//
// Building a vehicle tree — dozens of makes, hundreds of models — from an empty
// box is nobody's idea of a first five minutes, so the platform ships a library
// of starter lists (Vehicles, Devices, Pets, …) an owner can stamp as their own
// in one click. This is the empty-state path AND the "add another ready-made
// one" path for a business that already has some.
//
// ── Why a modal, in an app where a pane is the default ────────────────────
//
// It clears all four of the modal tests (docs/123): nothing is lost if it is
// abandoned (each install has already committed, or none has), there is no
// durable draft to return to (the durable thing — the installed list — opens as
// its OWN pane), nothing else needs to be on screen to pick a starter, and it is
// seconds of work. It is scoped to the pane that opened it via PaneScope, so it
// belongs to one document rather than the whole app.

import { useMemo, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  EmptyState,
  Heading,
  SearchInput,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { Check, PackagePlus } from 'lucide-react';
import { PaneScope } from '../../lib/dock/window-boundary';
import { resolveFitmentIcon } from './fitment-icons';
import {
  fitmentErrorMessage,
  useFitmentDictionaries,
  useInstallFitmentDictionary,
  type FitmentDictionaryOption,
} from './fitment-data';

export function FitmentDictionaryPicker({
  onClose,
  onInstalled,
}: {
  onClose: () => void;
  onInstalled: (domainId: string, name: string) => void;
}) {
  const toast = useToast();
  const query = useFitmentDictionaries();
  const install = useInstallFitmentDictionary();
  const [search, setSearch] = useState('');

  const options = useMemo(() => query.data ?? [], [query.data]);
  const needle = search.trim().toLowerCase();
  const matches = needle
    ? options.filter(
        (option) =>
          option.name.toLowerCase().includes(needle) ||
          option.description.toLowerCase().includes(needle) ||
          option.tags.some((tag) => tag.toLowerCase().includes(needle))
      )
    : options;

  const onInstall = (option: FitmentDictionaryOption) => {
    install.mutate(option.slug, {
      onSuccess: (created) => {
        onInstalled(created.id, option.name);
      },
      onError: (error) => {
        toast.add({
          title: `Could not install ${option.name}`,
          description: fitmentErrorMessage(error, 'Nothing was changed. Try again in a moment.'),
          type: 'error',
        });
      },
    });
  };

  return (
    <PaneScope>
      <Dialog
        open
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <DialogContent className="flex max-h-[calc(100%-2rem)] max-w-2xl flex-col overflow-hidden">
          <DialogTitle>Start from a ready-made list</DialogTitle>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 py-2">
            <Text className="text-sm">
              Each of these is a full list you can use as-is or change afterwards — install one and
              its entries are yours to add to, rename, or trim.
            </Text>

            <div className="max-w-xs">
              <SearchInput
                size="sm"
                aria-label="Search ready-made lists"
                placeholder="Search — vehicle, pet, phone…"
                value={search}
                onValueChange={setSearch}
              />
            </div>

            {query.isError ? (
              <Alert color="danger" variant="soft">
                <AlertContent>
                  <AlertTitle>Could not load the library</AlertTitle>
                  <AlertDescription>
                    This is a problem reaching the server. Nothing has been changed.
                  </AlertDescription>
                </AlertContent>
                <Button
                  size="sm"
                  color="danger"
                  variant="soft"
                  onClick={() => {
                    void query.refetch();
                  }}
                >
                  Try again
                </Button>
              </Alert>
            ) : query.isPending ? (
              <p className="text-sm" role="status">
                Loading…
              </p>
            ) : matches.length === 0 ? (
              <EmptyState
                icon={<PackagePlus className="size-6" aria-hidden />}
                title={needle ? 'Nothing matches that' : 'No ready-made lists available'}
                description={
                  needle
                    ? 'Try a different word, or build a list from scratch instead.'
                    : 'You can still build a compatibility list from scratch.'
                }
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {matches.map((option) => {
                  const Icon = resolveFitmentIcon(option.iconKey);
                  const installing = install.isPending && install.variables === option.slug;
                  return (
                    <li
                      key={option.slug}
                      className="border-base-300 flex items-start gap-3 rounded border p-3"
                    >
                      <Icon className="size-6 shrink-0" aria-hidden />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <Heading level={3} className="text-base font-semibold">
                          {option.name}
                        </Heading>
                        <Text className="text-sm">{option.description}</Text>
                        {option.summary.length > 0 ? (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {option.summary.map((chip, index) => (
                              <Badge
                                key={index}
                                color={chip.tone === 'module' ? 'module' : 'neutral'}
                                variant="soft"
                                size="sm"
                              >
                                {chip.label}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0 self-center">
                        {option.installed ? (
                          <Badge color="success" variant="soft" size="sm">
                            <Check className="size-3.5" aria-hidden />
                            Installed
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            color="module"
                            loading={installing}
                            disabled={install.isPending}
                            onClick={() => {
                              onInstall(option);
                            }}
                          >
                            Install
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button size="sm" variant="ghost" color="neutral" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}
