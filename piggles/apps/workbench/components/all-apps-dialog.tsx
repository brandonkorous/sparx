'use client';

// "All apps" — everything Piggles does, and which of it you keep in front of
// you.
//
// ── WHY THIS SCREEN HAS TO EXIST ────────────────────────────────────────────
//
// Onboarding asks what the business does and puts the matching apps on the rail.
// That answer is a PREFERENCE, not a purchase — Piggles has one plan with
// everything in it — and the only thing standing between "a sensible starting
// point" and "a paywall you can't see the far side of" is whether the apps you
// did not pick are still somewhere you can find them.
//
// This is that somewhere, and it goes BOTH ways. Adding one puts it on the rail;
// removing one takes it off and touches nothing else. Nothing here is bought,
// sold, or switched off underneath — see lib/console/rail.ts.
//
// The wording follows the lexicon: "Add app", never "enable module". A business
// owner does not have modules.

import { faCheck, faMinus, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  useToast,
} from '@wizeworks/silicaui-react';
import { useViewer } from '@/lib/api/shell-data';
import { AppScope } from './app-scope';
import { useAllApps, type ConsoleApp } from '@/lib/console/apps';
import { useRailPreference, useSetRailApps } from '@/lib/console/rail';

export function AllAppsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const apps = useAllApps();
  // A business that has never chosen has EVERY app on its rail, so the first
  // "put away" has to start from the full list rather than from an empty one.
  const baseline = apps.map((entry) => entry.app.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogTitle>All apps</DialogTitle>
        {/* Describes what is ACTUALLY on the screen. The first version said
            "these are just the ones you have not switched on yet" while listing
            all fifteen, on and off alike. */}
        <DialogDescription>
          Everything Piggles does. Every one of them is included and working — this only decides
          which are on your rail, and it never changes what you pay.
        </DialogDescription>

        {/* Two columns from `sm` up. Fifteen rows in one column is a scroll for
            something meant to be taken in at a glance. */}
        <ul className="mt-4 grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-2">
          {apps.map((entry) => (
            <li key={entry.app.id}>
              <AppCard entry={entry} baseline={baseline} />
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function AppCard({ entry, baseline }: { entry: ConsoleApp; baseline: string[] }) {
  const toast = useToast();
  const { data: viewer } = useViewer();
  const { data: rail } = useRailPreference();
  const setRail = useSetRailApps();

  // What the rail carries is a decision about the BUSINESS, so it is the
  // owner's or an admin's — mirroring the API, which is the real enforcement. A
  // teammate simply sees what exists and who to ask.
  const mayChange = viewer?.role === 'owner' || viewer?.role === 'admin';

  // Home is pinned: it is where the checklist and the way back live.
  const pinned = entry.app.id === 'home';

  const change = (next: boolean) => {
    // No preference yet means "everything", so the first change starts from the
    // full list rather than from an empty one.
    const current = rail?.apps ?? baseline;
    const apps = next ? [...current, entry.app.id] : current.filter((id) => id !== entry.app.id);

    setRail.mutate(apps, {
      onSuccess: () => {
        toast.add({
          title: next ? `${entry.label} is on your rail` : `${entry.label} is put away`,
          description: next
            ? 'It was always here — now it is where you can see it.'
            : 'Nothing was switched off or deleted. Add it back whenever you like.',
          type: 'success',
        });
      },
      onError: () => {
        toast.add({
          title: `${entry.label} could not be moved`,
          description: 'Nothing changed. Please try again in a moment.',
          type: 'error',
        });
      },
    });
  };

  const glyph = entry.icon;

  return (
    // The app's own hue, so this list reads as the rail does rather than as
    // fifteen identical grey rows — carried by the ICON and the button, not by a
    // tinted card. Fifteen cards in six hues would be competing washes rather
    // than wayfinding, and the chassis stays neutral for that reason (DESIGN.md).
    <AppScope app={entry.app.id} className="h-full">
      <Card className="h-full">
        <CardBody className="gap-2">
          <div className="flex items-center gap-2">
            <Icon glyph={glyph} className="text-module size-5 shrink-0" aria-hidden />
            <span className="flex-1 text-lg font-bold">{entry.label}</span>
            {entry.onRail ? (
              // State on a thing, which is what a Badge is for — not a label
              // introducing the heading beside it.
              <Badge color="success" variant="soft" size="sm">
                <Icon glyph={faCheck} className="size-3" aria-hidden />
                On your rail
              </Badge>
            ) : null}
          </div>

          <p className="text-base">{entry.app.purpose}</p>

          <AppAction
            entry={entry}
            pinned={pinned}
            mayChange={mayChange}
            busy={setRail.isPending}
            onChange={change}
          />
        </CardBody>
      </Card>
    </AppScope>
  );
}

function AppAction({
  entry,
  pinned,
  mayChange,
  busy,
  onChange,
}: {
  entry: ConsoleApp;
  pinned: boolean;
  mayChange: boolean;
  busy: boolean;
  onChange: (next: boolean) => void;
}) {
  if (pinned) return null;

  // Reachable is an ACCESS answer, not a rail one. Saying "add it" to somebody
  // who would then get an empty panel is worse than saying why not.
  if (!entry.available) {
    return (
      <p className="text-base">This one is not open to you — ask whoever owns this business.</p>
    );
  }

  if (!mayChange) {
    return <p className="text-base">Ask whoever owns this business to change your rail.</p>;
  }

  return (
    <div className="mt-1">
      {entry.onRail ? (
        <Button
          color="module"
          variant="outline"
          size="sm"
          loading={busy}
          onClick={() => {
            onChange(false);
          }}
        >
          <Icon glyph={faMinus} className="size-4" aria-hidden />
          Put away
        </Button>
      ) : (
        <Button
          color="module"
          size="sm"
          loading={busy}
          onClick={() => {
            onChange(true);
          }}
        >
          <Icon glyph={faPlus} className="size-4" aria-hidden />
          Add {entry.label}
        </Button>
      )}
    </div>
  );
}
