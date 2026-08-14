'use client';

// "All apps" — the answer to "where's the rest of it?".
//
// ── WHY THIS SCREEN HAS TO EXIST ────────────────────────────────────────────
//
// Onboarding asks what the business does and switches on the apps that match.
// That answer is a PREFERENCE, not a purchase — Piggles has one plan with
// everything in it — and the only thing standing between "a sensible starting
// point" and "a paywall you can't see the far side of" is whether the apps you
// did not pick are still somewhere you can find them.
//
// This is that somewhere. Every app in the catalogue, whether it is on or not,
// with what it is for and a one-tap way to add it. No price on the button,
// because there is no price: adding an app changes the workspace, never the bill
// (piggles/CLAUDE.md RULE #2).
//
// The wording follows the lexicon: "Add app", never "enable module". A business
// owner does not have modules.

import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
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
import { useQueryClient } from '@sparx/query';
import { api } from '@workbench/lib/api/client';
import { useViewer } from '@workbench/lib/api/shell-data';
import { AppScope } from './app-scope';
import { useAllApps, type ConsoleApp } from '@/lib/console/nav';

export function AllAppsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const apps = useAllApps();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogTitle>All apps</DialogTitle>
        <DialogDescription>
          Everything is included — these are just the ones you have not switched on yet. Adding one
          takes a moment and never changes what you pay.
        </DialogDescription>

        {/* Two columns from `sm` up. Fifteen rows in one column is a scroll for
            something meant to be taken in at a glance. */}
        <ul className="mt-4 grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-2">
          {apps.map((entry) => (
            <li key={entry.app.id}>
              <AppCard entry={entry} />
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function AppCard({ entry }: { entry: ConsoleApp }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: viewer } = useViewer();
  const [adding, setAdding] = useState(false);

  // Adding an app is an owner/admin action — api-rest requires `admin` on the
  // bulk route. A button that is certain to come back 403 is a worse way to
  // learn that than not offering it, so a teammate simply sees what exists and
  // who to ask. The API is the enforcement; this only mirrors it.
  const mayAdd = viewer?.role === 'owner' || viewer?.role === 'admin';

  const add = async () => {
    setAdding(true);
    try {
      // `PUT /v1/tenant/modules` directly, NOT the onboarding helper that wraps
      // it — that one also advances sparx's setup wizard to its next step, which
      // is a state this product does not have and would be writing nonsense
      // into.
      //
      // The route is the real activation path: it writes the flags, fixes
      // requirements forward, and announces `module.activated` — the event that
      // seeds the CRM's pipeline, commerce's tax and shipping defaults, the
      // automation catalogue and the default emails. A flag written without it
      // gets you an app that is switched on and empty. It MERGES, so adding one
      // app cannot switch another off.
      //
      // Every module the app fronts, in one call: "Sell" is commerce, B2B and
      // dropship, and adding two of the three would be a half-added app.
      await api.put('/v1/tenant/modules', {
        modules: Object.fromEntries(entry.app.modules.map((m) => [m, true])),
      });
      // The rail is derived from module state, so it has to re-read before the
      // new app can appear in it.
      await queryClient.invalidateQueries({ queryKey: ['tenant', 'modules'] });
      toast.add({
        title: `${entry.label} is ready`,
        description: 'It is on your rail now, set up and waiting.',
        type: 'success',
      });
    } catch {
      toast.add({
        title: `${entry.label} could not be added`,
        description: 'Nothing changed. Please try again in a moment.',
        type: 'error',
      });
    } finally {
      setAdding(false);
    }
  };

  const Icon = entry.icon;

  return (
    // The app's own hue, so this list reads as the rail does rather than as
    // fifteen identical grey rows — carried by the ICON and the Add button, not
    // by a tinted card. Fifteen cards in six hues would be competing washes
    // rather than wayfinding, and the chassis stays neutral for exactly that
    // reason (DESIGN.md). silica's Card has no `variant` prop at all; the tint
    // would be `bg-module bg-soft`, and it is deliberately not used here.
    <AppScope app={entry.app.id} className="h-full">
      <Card className="h-full">
        <CardBody className="gap-2">
          <div className="flex items-center gap-2">
            <Icon className="text-module size-5 shrink-0" aria-hidden />
            <span className="flex-1 text-lg font-bold">{entry.label}</span>
            {entry.active ? (
              // State on a thing, which is what a Badge is for — not a label
              // introducing the heading beside it.
              <Badge color="success" variant="soft" size="sm">
                <Check className="size-3" aria-hidden />
                On
              </Badge>
            ) : null}
          </div>

          <p className="text-base">{entry.app.purpose}</p>

          {entry.active ? null : mayAdd ? (
            <div className="mt-1">
              <Button
                color="module"
                size="sm"
                loading={adding}
                onClick={() => {
                  void add();
                }}
              >
                <Plus className="size-4" aria-hidden />
                Add {entry.label}
              </Button>
            </div>
          ) : (
            <p className="text-base">Ask whoever owns this business to switch it on.</p>
          )}
        </CardBody>
      </Card>
    </AppScope>
  );
}
