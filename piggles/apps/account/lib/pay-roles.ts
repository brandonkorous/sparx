// Who may put a card on file or change it: the people who answer for the bill.

const PAYING_ROLES = new Set(['owner', 'admin']);

export function canPay(role: string | null | undefined): boolean {
  return PAYING_ROLES.has(role ?? '');
}
