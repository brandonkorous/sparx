'use client';

// Install a ready-made compatibility list (Vehicles, Devices, Pets, ...) in one
// click, from empty or as another one. A modal: it passes the four modal tests
// (docs/123), and PaneScope ties it to the pane that opened it.

import { useMemo, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  EmptyState,
  SearchInput,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { faBoxOpen } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneScope } from '../../lib/dock/window-boundary';
import { FitmentDictionaryOptionRow } from './fitment-dictionary-option';
import {
  fitmentErrorMessage,
  useFitmentDictionaries,
  useInstallFitmentDictionary,
  type FitmentDictionaryOption,
} from './fitment-data';

function matching(options: FitmentDictionaryOption[], needle: string) {
  if (!needle) return options;
  return options.filter(
    (option) =>
      option.name.toLowerCase().includes(needle) ||
      option.description.toLowerCase().includes(needle) ||
      option.tags.some((tag) => tag.toLowerCase().includes(needle))
  );
}

function LibraryList({
  install,
  matches,
  onInstall,
}: {
  install: ReturnType<typeof useInstallFitmentDictionary>;
  matches: FitmentDictionaryOption[];
  onInstall: (option: FitmentDictionaryOption) => void;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {matches.map((option) => (
        <FitmentDictionaryOptionRow
          key={option.slug}
          option={option}
          installing={install.isPending && install.variables === option.slug}
          disabled={install.isPending}
          onInstall={() => {
            onInstall(option);
          }}
        />
      ))}
    </ul>
  );
}

function LibraryIntro({ search, onSearch }: { search: string; onSearch: (next: string) => void }) {
  return (
    <>
      <Text className="text-sm">
        Each of these is a starting list, not a complete one: the vehicle list, for one, has a
        handful of common makes and models rather than every vehicle on the road. Install one, then
        add the makes, models and engines you actually sell for. Everything in it is yours to add
        to, rename, or trim.
      </Text>
      <div className="max-w-xs">
        <SearchInput
          size="sm"
          aria-label="Search ready-made lists"
          placeholder="Search: vehicle, pet, phone…"
          value={search}
          onValueChange={onSearch}
        />
      </div>
    </>
  );
}

/** Installs one list; a refusal says so in a toast and changes nothing. */
function useInstallList(onInstalled: (domainId: string, name: string) => void) {
  const toast = useToast();
  const install = useInstallFitmentDictionary();
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
  return { install, onInstall };
}

function LibraryBody({
  query,
  install,
  needle,
  matches,
  onInstall,
}: {
  query: ReturnType<typeof useFitmentDictionaries>;
  install: ReturnType<typeof useInstallFitmentDictionary>;
  needle: string;
  matches: FitmentDictionaryOption[];
  onInstall: (option: FitmentDictionaryOption) => void;
}) {
  if (query.isError) {
    return (
      <PaneLoadError
        title="Could not load the library"
        description="This is a problem reaching the server. Nothing has been changed."
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  if (query.isPending) return <PaneWaiting />;
  if (matches.length === 0) {
    return (
      <EmptyState
        icon={<Icon glyph={faBoxOpen} className="size-6" aria-hidden />}
        title={needle ? 'Nothing matches that' : 'No ready-made lists available'}
        description={
          needle
            ? 'Try a different word, or build a list from scratch instead.'
            : 'You can still build a compatibility list from scratch.'
        }
      />
    );
  }
  return <LibraryList install={install} matches={matches} onInstall={onInstall} />;
}

export function FitmentDictionaryPicker({
  onClose,
  onInstalled,
}: {
  onClose: () => void;
  onInstalled: (domainId: string, name: string) => void;
}) {
  const query = useFitmentDictionaries();
  const { install, onInstall } = useInstallList(onInstalled);
  const [search, setSearch] = useState('');
  const options = useMemo(() => query.data ?? [], [query.data]);
  const needle = search.trim().toLowerCase();

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
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 py-2 [&>*]:shrink-0">
            <LibraryIntro search={search} onSearch={setSearch} />
            <LibraryBody
              query={query}
              install={install}
              needle={needle}
              matches={matching(options, needle)}
              onInstall={onInstall}
            />
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
