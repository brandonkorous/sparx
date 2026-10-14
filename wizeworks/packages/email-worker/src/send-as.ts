// A template send that asks to go out AS THE BUSINESS (`sendAs: 'tenant'`).
//
// Most coded templates go out from the platform: a password reset, a receipt for
// the platform's own bill. A few go to somebody outside the platform on the
// business's behalf (a supplier getting an order), and those must come from the
// business, with replies reaching it (sparx persona issue 071). A publisher with
// the email-platform package resolves that itself and sets `from`. One without it
// (the dropship worker, sparx persona issue 171) sets `sendAs` and this worker,
// which has it, fills the From in. One answer to "who is this from", in one place:
// `settingsService.senderHeaders`.

/** The fields this touches, on any template send. */
interface SendAsInput {
  from?: string;
  replyTo?: string;
  props: Record<string, unknown>;
}

/**
 * The send with the business's From and Reply-To, and `canReply` saying whether a
 * reply reaches it: a template that invites a reply nobody reads is worse than one
 * that names who to contact. What the send already set is kept.
 */
export function asTheBusiness<T extends SendAsInput>(
  send: T,
  sender: { from: string; replyTo: string | null }
): T {
  const replyTo = send.replyTo ?? sender.replyTo ?? undefined;
  return {
    ...send,
    from: send.from ?? sender.from,
    replyTo,
    props:
      'canReply' in send.props ? send.props : { ...send.props, canReply: replyTo !== undefined },
  };
}
