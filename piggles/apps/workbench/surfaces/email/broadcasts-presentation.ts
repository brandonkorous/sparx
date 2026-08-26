'use client';

// How a broadcast's data reads on screen: its state as a colored badge, its
// sender as a recipient sees it, and a server error as a sentence.

import { apiErrorMessage } from '../../lib/api-error';
import type { BroadcastStatus, EmailSettings, Tone } from './broadcasts-data';

/** A broadcast's state in plain words, with the tone that carries its color.
 *  Status is a semantic color axis — never a bland neutral pill. */
export function broadcastState(status: BroadcastStatus): { label: string; tone: Tone } {
  switch (status) {
    case 'draft':
      return { label: 'Draft', tone: 'info' };
    case 'scheduled':
      return { label: 'Scheduled', tone: 'warning' };
    case 'sending':
      return { label: 'Sending', tone: 'info' };
    case 'sent':
      return { label: 'Sent', tone: 'success' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'warning' };
    case 'failed':
      return { label: 'Failed', tone: 'error' };
  }
}

/** How the sending address will appear to a recipient.
 *
 *  The server resolves this — it is the literal `From` header the send builds,
 *  fallback included. This used to be re-derived here, which named a domain the
 *  platform does not send from and dropped the sender name, so the screen and
 *  the inbox disagreed about who the email was from. */
export function senderDisplay(settings: EmailSettings | undefined): string {
  return settings?.resolvedFrom ?? '';
}

/** Surface the server's own sentence for a 4xx — it names the exact problem (a
 *  broadcast already sent, no designed email attached, a schedule in the past) —
 *  else a plain fallback. */
export function broadcastErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}
