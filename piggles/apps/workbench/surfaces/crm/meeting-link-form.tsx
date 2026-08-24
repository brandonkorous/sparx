'use client';

// The dialog that makes or changes a booking link.
//
// Portalled into THIS pane, not the window: in a multi-document app a dialog
// belongs to the document that opened it, so making a link here must not black
// out whatever is docked beside it.

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
  FieldDescription,
  FieldLabel,
  Input,
  Select,
  Text,
  Textarea,
} from '@wizeworks/silicaui-react';
import { PaneScope } from '../../lib/dock/window-boundary';
import { slugifyTyping } from '../../lib/slugify';
import type { MeetingLink } from './workspace-data';

export interface LinkDraft {
  name: string;
  slug: string;
  serviceId: string;
  description: string;
}

export function MeetingLinkForm({
  open,
  editing,
  draft,
  setDraft,
  slugTouched,
  setSlugTouched,
  serviceItems,
  saving,
  canSubmit,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: MeetingLink | null;
  draft: LinkDraft;
  setDraft: (patch: Partial<LinkDraft>) => void;
  slugTouched: boolean;
  setSlugTouched: (next: boolean) => void;
  serviceItems: Record<string, string>;
  saving: boolean;
  canSubmit: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { name, slug, serviceId, description } = draft;
  const addressChanged = editing !== null && slug.trim() !== editing.slug;

  return (
    <PaneScope>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          // Escape, Cancel and a click outside all land here and all simply
          // close. Four fields nobody has committed are not worth a
          // "discard your changes?" question.
          if (!next) onClose();
        }}
      >
        <DialogContent className="flex max-h-[calc(100%-2rem)] max-w-lg flex-col overflow-hidden">
          <DialogTitle>{editing ? `Change ${editing.name}` : 'A new booking link'}</DialogTitle>

          <form
            id="booking-link-form"
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (canSubmit) onSubmit();
            }}
          >
            <Field>
              <FieldLabel>What to call it</FieldLabel>
              <Input
                color="module"
                value={name}
                placeholder="Discovery call"
                onChange={(event) => {
                  const typed = event.target.value;
                  // Follow the name until somebody edits the address themselves.
                  // Typing a name and getting a matching address is what people
                  // expect; overwriting one they chose is not.
                  setDraft(
                    slugTouched ? { name: typed } : { name: typed, slug: slugifyTyping(typed, 63) }
                  );
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
                  // Keeps a hyphen she just pressed; tidied on save (issue #181).
                  setDraft({ slug: slugifyTyping(event.target.value, 63) });
                }}
              />
              <FieldDescription>
                Customers will go to <Text as="span">/meet/{slug || 'discovery-call'}</Text>
              </FieldDescription>
            </Field>

            {/* Only when they have actually changed it, and only on a link
                that exists. Warning about it up front on every edit would
                train people to ignore the one time it matters. */}
            {addressChanged ? (
              <Alert color="warning">
                <AlertContent>
                  <AlertTitle>The old address stops working</AlertTitle>
                  <AlertDescription>
                    Anyone holding <Text as="span">/meet/{editing.slug}</Text> — in an email you
                    have already sent, in a signature, on a quote — will find it no longer resolves.
                    Change the address only if nobody has it yet.
                  </AlertDescription>
                </AlertContent>
              </Alert>
            ) : null}

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
                  setDraft({ serviceId: String(value) });
                }}
              />
              <FieldDescription>
                The length, your free times, how much notice you need and your cancellation terms
                all come from this — change them there and every link follows.
              </FieldDescription>
            </Field>

            {/* The row has always rendered this and no form ever set it, so
                every link's description was permanently null. */}
            <Field>
              <FieldLabel>What to say about it</FieldLabel>
              <Textarea
                color="module"
                rows={2}
                value={description}
                placeholder="Twenty minutes to talk through what you need — no charge."
                onChange={(event) => {
                  setDraft({ description: event.target.value });
                }}
              />
              <FieldDescription>
                Optional. Shown beside the link here, so whoever picks it can tell two similar ones
                apart.
              </FieldDescription>
            </Field>
          </form>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            {/* Tied to the form by id rather than nested in it — the footer is
                a sibling of the scrolling body, and this is what makes Enter
                in a field do the same thing as clicking here. */}
            <Button
              type="submit"
              form="booking-link-form"
              color="module"
              size="sm"
              loading={saving}
              disabled={!canSubmit}
            >
              {editing ? 'Save changes' : 'Create booking link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}
