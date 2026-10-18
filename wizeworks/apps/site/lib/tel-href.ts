/** A phone number as a dialable `tel:` URI — `+` and digits only, since that is
 *  what a dialer parses. Null in, null out (an unset number must not become the
 *  string "tel:"), and a number with no digits at all is treated as unset. */
export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  return /\d/.test(digits) ? `tel:${digits}` : null;
}
