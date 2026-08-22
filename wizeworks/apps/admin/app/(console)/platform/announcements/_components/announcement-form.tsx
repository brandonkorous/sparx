'use client';

// The notice editor — one form for writing a new notice and for editing one.
//
// It is deliberately ONE form and not two. The difference between create and
// edit here is an id and a heading; splitting them is how a field ends up on the
// create screen and missing from the edit screen, which is exactly the failure
// this record cannot afford (a link you can add but never remove).
//
// A LIVE PREVIEW sits above the fields, rendering the same bar the public sites
// render. Not decoration: this is a sentence that goes on the front page of a
// product, and the gap between "reads fine in a textarea" and "reads fine in a
// thin bar on a phone" is where the embarrassing ones happen.

import * as React from 'react';
import {
  Checkbox,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Textarea,
} from '@wizeworks/silicaui-react';
import { Button, Card, Stack, Text, toast } from '@wizeworks/ui';
import type { OperatorAnnouncement, OperatorAnnouncementTone } from '@wizeworks/operator';
import { BRAND_OPTIONS, SURFACE_OPTIONS, TONE_OPTIONS, toLocalInput } from '@/lib/announcements';
import { saveAnnouncementAction } from '../actions';
import { AnnouncementPreview } from './announcement-preview';

// A tickable row: the box, its name, and the one line that says what ticking it
// does. A two-column grid rather than a flex row, so the second line lines up
// under the first instead of under the checkbox — and the whole row is the hit
// target, which is what `htmlFor` on the <label> buys.
const OPTION_ROW =
  'grid cursor-pointer grid-cols-[auto_1fr] items-start gap-x-3 gap-y-0.5 leading-snug';

export function AnnouncementForm({ announcement }: { announcement?: OperatorAnnouncement }) {
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState(announcement?.message ?? '');
  const [linkLabel, setLinkLabel] = React.useState(announcement?.linkLabel ?? '');
  const [tone, setTone] = React.useState<OperatorAnnouncementTone>(announcement?.tone ?? 'primary');
  const [dismissible, setDismissible] = React.useState(announcement?.dismissible ?? true);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      // On success this action redirects, so it never resolves — anything that
      // comes back is a failure with something to say.
      const res = await saveAnnouncementAction(announcement?.id ?? null, form);
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <Stack gap={6}>
        <Stack gap={2}>
          <Text size="sm" weight="medium">
            What people will see
          </Text>
          <AnnouncementPreview
            message={message || 'Your notice will appear here.'}
            linkLabel={linkLabel}
            tone={tone}
            dismissible={dismissible}
          />
        </Stack>

        <Card>
          <Stack gap={5}>
            <Field>
              <FieldLabel htmlFor="message">The notice</FieldLabel>
              <FieldDescription>
                One sentence. It sits in a thin bar above everything else, so anything longer
                becomes two lines on a phone and pushes the page down.
              </FieldDescription>
              <Textarea
                id="message"
                name="message"
                rows={2}
                maxLength={300}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="linkLabel">Button text</FieldLabel>
                <FieldDescription>Leave both blank for a notice with no button.</FieldDescription>
                <Input
                  id="linkLabel"
                  name="linkLabel"
                  maxLength={60}
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                  placeholder="Email hello@meetpiggles.com"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="linkHref">Where it goes</FieldLabel>
                <FieldDescription>
                  A web address, or a mailto: link that opens their email.
                </FieldDescription>
                <Input
                  id="linkHref"
                  name="linkHref"
                  defaultValue={announcement?.linkHref ?? ''}
                  placeholder="mailto:hello@meetpiggles.com"
                />
              </Field>
            </div>
          </Stack>
        </Card>

        <Card>
          <Stack gap={5}>
            <Field>
              <FieldLabel htmlFor="platformBrand">Which product</FieldLabel>
              <FieldDescription>
                A notice belongs to one product. Piggles and sparx never share one.
              </FieldDescription>
              <NativeSelect
                id="platformBrand"
                name="platformBrand"
                defaultValue={announcement?.platformBrand ?? 'piggles'}
              >
                {BRAND_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <fieldset>
              <legend className="text-base-content mb-1 text-sm font-medium">Where it shows</legend>
              <Text size="sm" variant="muted">
                Pick every place this belongs. An offer belongs on the marketing site and the
                sign-up; it is noise above somebody&rsquo;s invoices.
              </Text>
              <Stack gap={2} className="mt-3">
                {SURFACE_OPTIONS.map((s) => (
                  <label key={s.value} htmlFor={`surface-${s.value}`} className={OPTION_ROW}>
                    <Checkbox
                      id={`surface-${s.value}`}
                      name="surfaces"
                      value={s.value}
                      color="primary"
                      defaultChecked={
                        announcement
                          ? announcement.surfaces.includes(s.value)
                          : s.value !== 'console'
                      }
                      className="row-span-2 mt-0.5"
                    />
                    <span className="text-base font-medium">{s.label}</span>
                    <span className="text-sm">{s.hint}</span>
                  </label>
                ))}
              </Stack>
            </fieldset>

            <Field>
              <FieldLabel htmlFor="tone">What kind of notice</FieldLabel>
              <FieldDescription>This sets the colour of the bar.</FieldDescription>
              <NativeSelect
                id="tone"
                name="tone"
                value={tone}
                onChange={(e) => setTone(e.target.value as OperatorAnnouncementTone)}
              >
                {TONE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </Stack>
        </Card>

        <Card>
          <Stack gap={5}>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="startsAt">Starts</FieldLabel>
                <FieldDescription>
                  Leave blank to start as soon as it is switched on.
                </FieldDescription>
                <Input
                  id="startsAt"
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={toLocalInput(announcement?.startsAt ?? null)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="endsAt">Ends</FieldLabel>
                <FieldDescription>
                  Leave blank to run until somebody takes it down. Setting a date is how an offer
                  stops advertising itself after it has closed.
                </FieldDescription>
                <Input
                  id="endsAt"
                  name="endsAt"
                  type="datetime-local"
                  defaultValue={toLocalInput(announcement?.endsAt ?? null)}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="priority">Order</FieldLabel>
              <FieldDescription>
                Only one notice shows at a time. If two are running in the same place, the higher
                number wins.
              </FieldDescription>
              <Input
                id="priority"
                name="priority"
                type="number"
                min={0}
                max={1000}
                defaultValue={String(announcement?.priority ?? 0)}
                className="max-w-32"
              />
            </Field>

            <label htmlFor="dismissible" className={OPTION_ROW}>
              <Checkbox
                id="dismissible"
                name="dismissible"
                color="primary"
                checked={dismissible}
                onChange={(e) => setDismissible(e.target.checked)}
                className="row-span-2 mt-0.5"
              />
              <span className="text-base font-medium">People can close it</span>
              <span className="text-sm">An offer should be closeable. An outage should not.</span>
            </label>

            <label htmlFor="isActive" className={OPTION_ROW}>
              <Checkbox
                id="isActive"
                name="isActive"
                color="success"
                defaultChecked={announcement?.isActive ?? false}
                className="row-span-2 mt-0.5"
              />
              <span className="text-base font-medium">Switch it on</span>
              <span className="text-sm">
                Off means saved but not showing. You can switch it on from the list later.
              </span>
            </label>
          </Stack>
        </Card>

        <Stack direction="row" gap={3}>
          <Button type="submit" color="primary" disabled={pending}>
            {announcement ? 'Save changes' : 'Create notice'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => history.back()} disabled={pending}>
            Cancel
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}
