'use client';

// Booking links — the address a rep puts in an email so a customer can pick a
// time (docs/144 §12).
//
// ONE SURFACE, NOT A LIST AND A DETAIL. A link is four fields and they all fit
// on one row; a detail pane for each would be a screen to open in order to
// change one word.
//
// AND CREATING ONE IS A DIALOG, not a form parked above the list. The test is
// docs/123 §"Pane or modal?": does create have the same shape as edit? For a
// site it does, so creating a site is the manage pane in its `{id:'new'}` state.
// A booking link has no manage pane at all — the row is the whole of it, and the
// only things you do to one afterwards are copy it, open it and retire it. So
// there is nothing to return to, nothing is lost by abandoning three fields, and
// it is over in seconds: the same shape as inviting a teammate. Left inline, the
// creator sat permanently on top of the thing people came to look at, pushing
// the list down the page every single visit for the sake of an action taken
// once.
//
// THE LINK IS DELIBERATELY THIN. It does not own how long the meeting is, when
// you are free, how much notice you need or what happens if somebody cancels —
// the bookable service owns every one of those, and putting a second copy here
// would give a business two places to change one thing and no way to tell which
// one the customer sees. What this adds is a memorable address, whose calendar
// it fills, and the fact that a booking through it lands on the contact's
// timeline instead of only in a calendar.

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Heading,
  Input,
  Select,
  Table,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { CalendarClock, Copy, Link2, Plus } from 'lucide-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { PaneScope } from '../../lib/dock/window-boundary';
import { useConfirm } from '../../lib/confirm';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useSchedulingServices } from '../scheduling/bookings-data';
import { useActiveSiteSlug } from '../../lib/api/shell-data';
import {
  useMeetingLinkMutations,
  useMeetingLinks,
  workspaceErrorMessage,
  type MeetingLink,
} from './workspace-data';

const COLUMN = 'mx-auto flex w-full max-w-4xl flex-col gap-4';

/** `Discovery call` → `discovery-call`. Typed for people, not for URLs. */
function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

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

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);

  const closeCreator = (): void => {
    setCreating(false);
    setName('');
    setSlug('');
    setServiceId('');
    setSlugTouched(false);
  };

  const serviceItems = useMemo(
    () =>
      Object.fromEntries(
        (services.data?.items ?? []).map((s) => [s.id, `${s.name} · ${s.durationMinutes} min`])
      ),
    [services.data]
  );

  const publicUrl = (link: MeetingLink): string => {
    const base = siteSlug ? `${siteSlug}` : 'your-site';
    return `${base}/meet/${link.slug}`;
  };

  const copy = async (link: MeetingLink): Promise<void> => {
    await navigator.clipboard.writeText(publicUrl(link));
    toast.add({ title: 'Link copied', type: 'success' });
  };

  const canCreate = name.trim() !== '' && slug.trim() !== '' && serviceId !== '';

  const submit = (): void => {
    create.mutate(
      { name: name.trim(), slug: slug.trim(), serviceId },
      {
        onSuccess: () => {
          closeCreator();
          toast.add({ title: 'Booking link created', type: 'success' });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not create that link',
            description: workspaceErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
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
      <PaneToolbar label="Booking link actions">
        <CalendarClock className="size-4 shrink-0" aria-hidden />
        <Text as="span" className="text-sm">
          {rows.length === 0
            ? 'No booking links yet'
            : rows.length === 1
              ? '1 booking link'
              : `${String(rows.length)} booking links`}
        </Text>
        <Button
          color="module"
          size="sm"
          className="ml-auto shrink-0"
          disabled={noServices}
          title={
            noServices
              ? 'Set up something bookable under Scheduling first'
              : 'Make a new booking link'
          }
          onClick={() => {
            setCreating(true);
          }}
        >
          <Plus className="size-4" aria-hidden />
          New booking link
        </Button>
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {noServices ? (
            <Alert color="info" variant="soft">
              <AlertContent>
                <AlertTitle>You need something bookable first</AlertTitle>
                <AlertDescription>
                  A booking link points at one of your bookable services — that is where the length,
                  your availability and your cancellation terms come from. Set one up under
                  Scheduling, then come back.
                </AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          {rows.length > 0 ? (
            <Card className="p-0">
              <Table>
                <thead>
                  <tr>
                    <th>Link</th>
                    <th className="hidden @md:table-cell">Address</th>
                    <th className="hidden @lg:table-cell">Booked</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((link) => (
                    <tr key={link.id}>
                      <td>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Text as="span" className="font-medium">
                              {link.name}
                            </Text>
                            {link.archivedAt ? (
                              <Badge color="neutral" variant="soft" size="sm">
                                Retired
                              </Badge>
                            ) : link.isActive ? (
                              <Badge color="success" variant="soft" size="sm">
                                Taking bookings
                              </Badge>
                            ) : (
                              <Badge color="warning" variant="soft" size="sm">
                                Paused
                              </Badge>
                            )}
                          </div>
                          {link.description ? <Text>{link.description}</Text> : null}
                        </div>
                      </td>
                      <td className="hidden @md:table-cell">
                        <Text as="span" className="text-sm">
                          /meet/{link.slug}
                        </Text>
                      </td>
                      <td className="hidden @lg:table-cell">
                        <Text as="span">{link.bookingCount}</Text>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            color="module"
                            variant="ghost"
                            size="sm"
                            aria-label={`Copy the link for ${link.name}`}
                            title="Copy this link"
                            onClick={() => void copy(link)}
                          >
                            <Copy className="size-4" aria-hidden />
                          </Button>
                          {link.archivedAt ? null : (
                            <>
                              <Button
                                color="module"
                                variant="ghost"
                                size="sm"
                                aria-label={
                                  link.isActive
                                    ? `Pause ${link.name}`
                                    : `Start taking bookings on ${link.name}`
                                }
                                title={link.isActive ? 'Pause it' : 'Start taking bookings'}
                                onClick={() => {
                                  update.mutate({
                                    id: link.id,
                                    patch: { isActive: !link.isActive },
                                  });
                                }}
                              >
                                <Link2 className="size-4" aria-hidden />
                              </Button>
                              <Button
                                color="danger"
                                variant="ghost"
                                size="sm"
                                aria-label={`Stop using ${link.name}`}
                                title="Stop using it"
                                onClick={() => void retire(link)}
                              >
                                <Text as="span" className="text-sm">
                                  Retire
                                </Text>
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          ) : (
            // A bare heading over blank space says nothing. Somebody who has
            // never made one of these needs to know what they would get.
            <div className="flex flex-col gap-1">
              <Heading level={2} className="text-lg">
                No booking links yet
              </Heading>
              <Text>
                Make one and you get a web address you can put in an email signature, on a quote, or
                in a reply — anyone who opens it picks a time from your real availability and the
                booking lands in your calendar, with the customer already attached.
              </Text>
            </div>
          )}
        </div>
      </div>

      {/* Portalled into THIS pane, not the window: in a multi-document app a
          dialog belongs to the document that opened it, so making a link here
          must not black out whatever is docked beside it. */}
      <PaneScope>
        <Dialog
          open={creating}
          onOpenChange={(next) => {
            // Escape, Cancel and a click outside all land here and all simply
            // close. Three fields nobody has committed are not worth a
            // "discard your changes?" question.
            if (!next) closeCreator();
          }}
        >
          <DialogContent className="flex max-h-[calc(100%-2rem)] max-w-lg flex-col overflow-hidden">
            <DialogTitle>A new booking link</DialogTitle>

            <form
              id="new-booking-link"
              className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (canCreate) submit();
              }}
            >
              <Field>
                <FieldLabel>What to call it</FieldLabel>
                <Input
                  color="module"
                  value={name}
                  placeholder="Discovery call"
                  onChange={(event) => {
                    setName(event.target.value);
                    // Follow the name until somebody edits the address themselves.
                    // Typing a name and getting a matching address is what people
                    // expect; overwriting one they chose is not.
                    if (!slugTouched) setSlug(slugify(event.target.value));
                  }}
                />
                <FieldDescription>Your customer sees this, so use their words.</FieldDescription>
              </Field>

              <Field>
                <FieldLabel>Its web address</FieldLabel>
                <Input
                  color="module"
                  value={slug}
                  placeholder="discovery-call"
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => {
                    setSlugTouched(true);
                    setSlug(slugify(event.target.value));
                  }}
                />
                <FieldDescription>
                  Customers will go to <Text as="span">/meet/{slug || 'discovery-call'}</Text>
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>What gets booked</FieldLabel>
                {/* An unset Select with no placeholder is an empty box: it reads
                    as a field that failed to load, not one waiting for a choice —
                    and the create button is disabled until it is set, so the
                    whole dialog looks broken rather than unfinished. */}
                <Select
                  color="module"
                  aria-label="Which service this link books"
                  placeholder="Choose a service…"
                  value={serviceId}
                  items={serviceItems}
                  onValueChange={(value) => {
                    setServiceId(String(value));
                  }}
                />
                <FieldDescription>
                  The length, your free times, how much notice you need and your cancellation terms
                  all come from this — change them there and every link follows.
                </FieldDescription>
              </Field>
            </form>

            <DialogFooter>
              <Button color="neutral" variant="ghost" size="sm" onClick={closeCreator}>
                Cancel
              </Button>
              {/* Tied to the form by id rather than nested in it — the footer is
                  a sibling of the scrolling body, and this is what makes Enter
                  in a field do the same thing as clicking here. */}
              <Button
                type="submit"
                form="new-booking-link"
                color="module"
                size="sm"
                loading={create.isPending}
                disabled={!canCreate}
              >
                Create booking link
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PaneScope>
    </div>
  );
}
