'use client';

// Booking links — the address a rep puts in an email so a customer can pick a
// time (docs/144 §12).
//
// ONE SURFACE, NOT A LIST AND A DETAIL. A link is four fields and they all fit
// on one row; a detail pane for each would be a screen to open in order to
// change one word.
//
// AND IT IS A DIALOG, not a form parked above the list. The test is docs/123
// §"Pane or modal?": does create have the same shape as edit? Here it does —
// they are literally the same four fields — so ONE dialog serves both, which is
// the opposite of the site case where the shared shape argued for a pane. There
// is nothing to return to, nothing is lost by abandoning four fields, and it is
// over in seconds. Left inline, the creator sat permanently on top of the thing
// people came to look at, pushing the list down the page every single visit for
// the sake of an action taken once.
//
// EDITING EXISTS, and for a while it did not. The API has always accepted a
// PATCH and the surface only ever sent one for the pause toggle, so a link's
// name — the words a CUSTOMER reads in an email signature — was fixed forever at
// whatever was typed the first time. Fixing a typo meant retiring the link and
// minting a new address, which breaks every email that already carries the old
// one. Changing the address is still called out as the dangerous one, because
// that is the field with someone else's copy of it out in the world.
//
// THE LINK IS DELIBERATELY THIN. It does not own how long the meeting is, when
// you are free, how much notice you need or what happens if somebody cancels —
// the bookable service owns every one of those, and putting a second copy here
// would give a business two places to change one thing and no way to tell which
// one the customer sees. What this adds is a memorable address, whose calendar
// it fills, and the fact that a booking through it lands on the contact's
// timeline instead of only in a calendar.

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { useConfirm } from '../../lib/confirm';
import { useActiveSiteSlug } from '../../lib/api/shell-data';
import { slugify } from '../../lib/slugify';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { MeetingLinksBody } from './meeting-links-body';
import { MeetingLinksToolbar } from './meeting-links-toolbar';
import { MeetingLinkForm, type LinkDraft } from './meeting-link-form';
import { useSchedulingServices } from '../scheduling/bookings-data';
import {
  useMeetingLinkMutations,
  useMeetingLinks,
  workspaceErrorMessage,
  type MeetingLink,
} from './workspace-data';

const BLANK: LinkDraft = { name: '', slug: '', serviceId: '', description: '' };

export function MeetingLinksSurface({ ctx }: { ctx: SurfaceContext }) {
  const links = useMeetingLinks();
  const services = useSchedulingServices('');
  const { create, update, archive } = useMeetingLinkMutations();
  const toast = useToast();
  const confirm = useConfirm();
  const siteSlug = useActiveSiteSlug();

  useEffect(() => {
    ctx.setTitle('Booking links');
  }, [ctx]);

  const [open, setOpen] = useState(false);
  /** The link being edited, or null when the dialog is making a new one. */
  const [editing, setEditing] = useState<MeetingLink | null>(null);
  const [draft, setDraftState] = useState<LinkDraft>(BLANK);
  const [slugTouched, setSlugTouched] = useState(false);

  const setDraft = (patch: Partial<LinkDraft>) => {
    setDraftState((current) => ({ ...current, ...patch }));
  };

  const closeDialog = (): void => {
    setOpen(false);
    setEditing(null);
    setDraftState(BLANK);
    setSlugTouched(false);
  };

  const startNew = (): void => {
    setEditing(null);
    setDraftState(BLANK);
    setSlugTouched(false);
    setOpen(true);
  };

  const startEdit = (link: MeetingLink): void => {
    setEditing(link);
    setDraftState({
      name: link.name,
      slug: link.slug,
      serviceId: link.serviceId,
      description: link.description ?? '',
    });
    // The address is already whatever they chose, so it must never start
    // following the name again and quietly rewrite a live URL.
    setSlugTouched(true);
    setOpen(true);
  };

  const serviceItems = useMemo(
    () =>
      Object.fromEntries(
        (services.data?.items ?? []).map((s) => [
          s.id,
          `${s.name} · ${String(s.durationMinutes)} min`,
        ])
      ),
    [services.data]
  );

  const copy = async (link: MeetingLink): Promise<void> => {
    const base = siteSlug ? `${siteSlug}` : 'your-site';
    await navigator.clipboard.writeText(`${base}/meet/${link.slug}`);
    toast.add({ title: 'Link copied', type: 'success' });
  };

  const canSubmit = draft.name.trim() !== '' && draft.slug.trim() !== '' && draft.serviceId !== '';

  const submit = (): void => {
    const fields = {
      name: draft.name.trim(),
      // Tidied on the way out: the address field keeps a trailing hyphen while
      // it is being typed, so one can survive being pressed (issue #181).
      slug: slugify(draft.slug, 63),
      serviceId: draft.serviceId,
      description: draft.description.trim() === '' ? null : draft.description.trim(),
    };

    const told = (verb: 'saved' | 'created') => ({
      onSuccess: () => {
        closeDialog();
        toast.add({ title: `Booking link ${verb}`, type: 'success' as const });
      },
      onError: (error: unknown) => {
        toast.add({
          title: verb === 'saved' ? 'Could not save that link' : 'Could not create that link',
          description: workspaceErrorMessage(error, 'Nothing was changed.'),
          type: 'error' as const,
        });
      },
    });

    if (editing) {
      update.mutate({ id: editing.id, patch: fields }, told('saved'));
      return;
    }
    create.mutate(fields, told('created'));
  };

  const retire = async (link: MeetingLink): Promise<void> => {
    const ok = await confirm({
      title: `Stop using ${link.name}?`,
      description:
        'Anybody who already has this link will be told it is no longer in use rather than seeing an error. Bookings already made are untouched.',
      confirmLabel: 'Stop using it',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    archive.mutate(link.id, {
      onSuccess: () => {
        toast.add({ title: `${link.name} retired`, type: 'success' });
      },
    });
  };

  const rows = links.data?.items ?? [];
  const noServices = services.isSuccess && (services.data?.items.length ?? 0) === 0;

  return (
    <div className={PANE_SHELL}>
      <MeetingLinksToolbar
        count={rows.length}
        noServices={noServices}
        onNew={startNew}
        refresh={
          <RefreshButton
            isFetching={links.isFetching || services.isFetching}
            updatedAt={links.data ? links.dataUpdatedAt : undefined}
            onRefresh={() => {
              void links.refetch();
              void services.refetch();
            }}
          />
        }
      />

      <MeetingLinksBody
        rows={rows}
        noServices={noServices}
        onCopy={(link) => {
          void copy(link);
        }}
        onEdit={startEdit}
        onTogglePaused={(link) => {
          update.mutate({ id: link.id, patch: { isActive: !link.isActive } });
        }}
        onRetire={(link) => {
          void retire(link);
        }}
      />

      <MeetingLinkForm
        open={open}
        editing={editing}
        draft={draft}
        setDraft={setDraft}
        slugTouched={slugTouched}
        setSlugTouched={setSlugTouched}
        serviceItems={serviceItems}
        saving={editing ? update.isPending : create.isPending}
        canSubmit={canSubmit}
        onClose={closeDialog}
        onSubmit={submit}
      />
    </div>
  );
}
