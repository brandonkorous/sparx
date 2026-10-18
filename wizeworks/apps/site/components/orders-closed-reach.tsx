// The sentence after "Nothing will be charged." on a shop that cannot be paid on
// its website yet: how to order instead, with the shop's own phone number and
// email as links (sparx persona issue 324).

import { shopReach } from '@/lib/orders-closed';

export function OrdersClosedReach({
  contact,
}: {
  contact?: { phone?: string | null; email?: string | null } | null;
}) {
  const { phone, email } = shopReach(contact);
  if (!phone && !email) return <> To order, get in touch with the shop.</>;
  return (
    <>
      {' '}
      To order,{' '}
      {phone ? (
        <>
          call{' '}
          <a href={phone.href} className="link font-semibold whitespace-nowrap">
            {phone.label}
          </a>
        </>
      ) : null}
      {phone && email ? ' or ' : null}
      {email ? (
        <>
          email{' '}
          <a href={email.href} className="link font-semibold break-words">
            {email.label}
          </a>
        </>
      ) : null}
      .
    </>
  );
}
