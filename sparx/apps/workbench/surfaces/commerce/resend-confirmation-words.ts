// The words for "Email the confirmation again" (sparx persona issue 336).

export interface ResendResult {
  sent: boolean;
  reason: string | null;
  to: string | null;
}

/** What the owner is told when nothing went, in her words. */
export function resendRefusal(result: ResendResult): string {
  switch (result.reason) {
    case 'no-email':
      return 'This order has no email address to send to.';
    case 'suppressed':
      return `${result.to ?? 'This address'} is on your do-not-email list, because an email to it bounced or was marked as spam.`;
    case 'no-template':
      return 'Your order confirmation email is not set up yet.';
    default:
      return 'The email could not be sent just now. Try again in a minute.';
  }
}
