'use client';

// Booking links — the address a rep puts in an email so a customer can pick a
// time (docs/144 §12).
//
// ONE SURFACE, NOT A LIST AND A DETAIL. A link is four fields and they all fit
// on one row; a detail pane for each would be a screen to open in order to
// change one word.
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
import { CalendarClock, Copy, Link2 } from 'lucide-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { FormSection } from '../../components/form-section';
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

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);

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
          setName('');
          setSlug('');
          setServiceId('');
          setSlugTouched(false);
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
          {rows.length === 0 ? 'No booking links yet' : `${rows.length} booking links`}
        </Text>
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

          <FormSection
            title="A new booking link"
            description="Give it a name your customer will recognise and pick what gets booked."
          >
            <div className="grid gap-3 @md:grid-cols-2">
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
            </div>

            <Field>
              <FieldLabel>What gets booked</FieldLabel>
              <Select
                color="module"
                aria-label="Which service this link books"
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

            <div>
              <Button
                color="module"
                size="sm"
                loading={create.isPending}
                disabled={!canCreate}
                onClick={submit}
              >
                Create booking link
              </Button>
            </div>
          </FormSection>

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
            <Heading level={2} className="text-lg">
              Nothing here yet
            </Heading>
          )}
        </div>
      </div>
    </div>
  );
}
