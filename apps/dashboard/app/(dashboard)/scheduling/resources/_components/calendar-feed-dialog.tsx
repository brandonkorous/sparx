'use client';

// Per-resource subscribe-to calendar feed (docs/79 §8.1, Layer 1). Shows the
// resource's private `.ics` URL the staff member adds to Google/Outlook/Apple once;
// their sparx bookings then appear automatically. The URL is signed (the token IS
// the auth), so it's fetched on open rather than embedded in the page. Read-only,
// one-way (sparx → their calendar), and clearly labeled as cache-stale — never the
// authoritative source (the DB no-overlap constraint, §7.4, is).

import { useEffect, useState } from 'react';
import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
  Text,
  toast,
} from '@sparx/ui';
import { Copy } from 'lucide-react';

import { getResourceFeedUrlAction } from '../../_lib/actions';
import { CalendarConnectionsSection } from './calendar-connections-section';

export function CalendarFeedDialog({
  resourceId,
  resourceName,
  open,
  onOpenChange,
}: {
  resourceId: string;
  resourceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFeedUrl(null);
    setError(null);
    let active = true;
    void getResourceFeedUrlAction(resourceId).then((r) => {
      if (!active) return;
      if (r.ok) setFeedUrl(r.data.feedUrl);
      else setError(r.error);
    });
    return () => {
      active = false;
    };
  }, [open, resourceId]);

  async function copy() {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      toast.success('Feed URL copied');
    } catch {
      toast.error('Could not copy — select the text and copy manually');
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-xl">
        <ModalHeader>
          <ModalTitle>Calendar sync — {resourceName}</ModalTitle>
          <ModalDescription>
            Two-way at a glance: subscribe to this resource&rsquo;s sparx bookings, and import an
            outside calendar so its events block sparx slots.
          </ModalDescription>
        </ModalHeader>

        <p className="px-1 pt-1 text-sm font-medium">Subscribe to this resource&rsquo;s bookings</p>
        <div className="flex flex-col gap-3 px-1 py-2">
          {error ? (
            <Text size="sm" variant="danger">
              {error}
            </Text>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={feedUrl ?? 'Generating…'}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Calendar feed URL"
              />
              <Button
                type="button"
                variant="soft"
                color="module"
                onClick={() => void copy()}
                disabled={!feedUrl}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
            </div>
          )}
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Keep this link private — anyone with it can see this resource&rsquo;s schedule.
            Subscribed calendars refresh on the provider&rsquo;s own cadence (Google ~12h, Outlook
            ~24h), so it can lag; sparx remains the source of truth for availability.
          </p>
        </div>

        <hr className="my-1 border-[var(--color-border)]" />

        <div className="px-1 py-2">
          <CalendarConnectionsSection resourceId={resourceId} />
        </div>
      </ModalContent>
    </Modal>
  );
}
