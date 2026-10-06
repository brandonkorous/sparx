import {
  type SignOff,
  type DayFormat,
  peopleWords,
  atCompany,
  namedAlreadyApprove,
} from './people-words';

/* ── The held order's own pane ─────────────────────────────────────────── */

export interface HeldOrderNotice {
  tone: 'warning' | 'info';
  title: string;
  detail: string;
}

// What the order pane says about a held order. `signOff` is null when the queue
// could not say, and the pane then says only what is certain.
export function heldOrderNotice(
  signOff: SignOff | null,
  companyName: string | null,
  day: DayFormat
): HeldOrderNotice {
  if (signOff === null) {
    return {
      tone: 'warning',
      title: 'Waiting for sign-off',
      detail:
        'It went over a limit, so nothing goes out until it is approved. Approvals shows who ' +
        'it is waiting on.',
    };
  }
  const waitingOnUs = signOff.waitingOn.includes('business');
  const waitingOnThem = signOff.waitingOn.includes('account');
  const names = peopleWords(signOff.accountApprovers.map((approver) => approver.name));
  // The title names who; the detail says where and what next, never the
  // names again (see SAY IT ONCE above).
  const they = namedAlreadyApprove(signOff.accountApprovers);
  const where = atCompany(companyName);

  if (waitingOnThem && waitingOnUs) {
    return {
      tone: 'warning',
      title: `Waiting for your team and ${names}`,
      detail:
        `${they} on your site${where}, and your team approves under Approvals. Either can go ` +
        'first, and nothing goes out until both have.',
    };
  }
  if (waitingOnThem) {
    const ours = signOff.signed.business;
    return {
      tone: 'info',
      title: `Waiting for ${names}`,
      detail:
        `${they} it on your site${where}, and it goes ahead as soon as they do.` +
        (ours ? ` ${ours.name} approved it for your team on ${day(ours.at)}.` : '') +
        ' You can still turn it down under Approvals.',
    };
  }
  return teamOnlyNotice(signOff, companyName, day);
}

// Waiting only on the team: names whoever at the account already said yes.
function teamOnlyNotice(
  signOff: SignOff,
  companyName: string | null,
  day: DayFormat
): HeldOrderNotice {
  const theirs = signOff.signed.account;
  return {
    tone: 'warning',
    title: 'Waiting for your team',
    detail: theirs
      ? `${theirs.name}${companyName ? ` at ${companyName}` : ''} approved it on ${day(theirs.at)}. ` +
        'It goes ahead as soon as it is approved under Approvals.'
      : 'It went over a limit, so nothing goes out until it is approved under Approvals.',
  };
}
