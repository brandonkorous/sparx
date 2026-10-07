import { Alert } from '@wizeworks/silicaui-react';
import { BILLING_EMAIL } from '@piggles/config/pricing';

type Tone = 'success' | 'info' | 'warning' | 'danger';

const COULD_NOT_OPEN = `The payment page could not be opened, and nothing was charged. Try again in a minute, or write to ${BILLING_EMAIL}.`;

/** What came back from Stripe (or from trying to reach it), keyed by the marker
 *  the return address carries. Anything unrecognized says nothing. */
const NOTICES: Record<string, { tone: Tone; text: string }> = {
  success: {
    tone: 'success',
    text: 'Your card is saved. It can take a minute to show on this page.',
  },
  cancelled: {
    tone: 'info',
    text: 'Nothing was saved. You can add a card whenever you are ready.',
  },
  already_active: {
    tone: 'info',
    text: 'There is already a card on file. Use the button below to see invoices or change it.',
  },
  'not-allowed': {
    tone: 'warning',
    text: 'Only the owner or an admin of this business can add or change the card.',
  },
  failed: { tone: 'danger', text: COULD_NOT_OPEN },
  unconfigured: { tone: 'danger', text: COULD_NOT_OPEN },
  no_paid_modules: { tone: 'danger', text: COULD_NOT_OPEN },
};

export function BillingNotice({ marker }: { marker: string | undefined }) {
  const notice = marker ? NOTICES[marker] : undefined;
  if (!notice) return null;
  return (
    <Alert className="mt-8" color={notice.tone} variant="soft" role="status">
      {notice.text}
    </Alert>
  );
}
