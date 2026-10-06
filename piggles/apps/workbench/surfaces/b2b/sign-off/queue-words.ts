import { type SignOff, type SignOffTone, type DayFormat, whoAt, atCompany } from './people-words';

/* ── One held order in the queue ───────────────────────────────────────── */

export interface QueueSignOffView {
  /** The business's part is still to sign, so Approve is offered. */
  canApprove: boolean;
  /** State on the row: who has signed, who is still to. Empty on an order
   *  only the team was ever asked about: Approve already says that, and a
   *  badge every row repeats would say nothing. */
  badges: { label: string; tone: SignOffTone }[];
  /** What happens next, when it is not simply "you approve it". */
  line: string | null;
}

// Who has signed and who is still to, as badges on the queue row.
function queueBadges(
  signOff: SignOff,
  day: DayFormat,
  waitingOnUs: boolean,
  waitingOnThem: boolean
): QueueSignOffView['badges'] {
  const badges: QueueSignOffView['badges'] = [];
  const theirsInvolved = signOff.needs.includes('account');

  for (const side of ['account', 'business'] as const) {
    const signature = signOff.signed[side];
    if (signature) {
      badges.push({
        label: `Approved by ${signature.name}, ${day(signature.at)}`,
        tone: 'success',
      });
    }
  }
  if (waitingOnUs && theirsInvolved) badges.push({ label: 'Needs your approval', tone: 'warning' });
  if (waitingOnThem) {
    const only = signOff.accountApprovers.length === 1 ? signOff.accountApprovers[0] : undefined;
    badges.push({
      label: only ? `Waiting for ${only.name}` : 'Waiting for their approvers',
      tone: 'info',
    });
  }
  return badges;
}

export function queueSignOffView(
  signOff: SignOff,
  companyName: string | null,
  day: DayFormat
): QueueSignOffView {
  const waitingOnUs = signOff.waitingOn.includes('business');
  const waitingOnThem = signOff.waitingOn.includes('account');
  const badges = queueBadges(signOff, day, waitingOnUs, waitingOnThem);

  // The badge names one approver; with several it says "their approvers", so
  // the sentence names them instead. Either way the name is said once.
  const badgeNamesThem = signOff.accountApprovers.length === 1;
  const where = atCompany(companyName);
  const them = whoAt(signOff.accountApprovers, companyName);
  let line: string | null = null;
  if (waitingOnThem && !waitingOnUs) {
    line = badgeNamesThem
      ? `They approve it on your site${where}. It goes ahead as soon as they do, and you can ` +
        'still turn it down here.'
      : `${them} can approve it on your site. It goes ahead as soon as one of them does, and ` +
        'you can still turn it down here.';
  } else if (waitingOnThem && waitingOnUs) {
    line = badgeNamesThem
      ? 'Either of you can go first, and it goes ahead once you both have. They approve on ' +
        `your site${where}.`
      : 'Either side can go first, and it goes ahead once both have. ' +
        `${them} can approve on your site.`;
  } else if (waitingOnUs && signOff.signed.account) {
    // "Needs your approval" beside it already says whose turn it is.
    line = 'It goes ahead as soon as you approve it.';
  }

  return { canApprove: waitingOnUs, badges, line };
}
