// Which `processor` values mean a gateway is actually holding the charge.
//
// An order payment's `processor` records HOW the money arrived, and only two of
// those ways leave a charge sitting somewhere a refund call can reverse. Every
// other value is money a person handed over — cash, a cheque, a bank transfer,
// a card run on the shop's OWN terminal, an account on terms — and giving it
// back is the shop counting notes out, not an API call.
//
// This lives in the payments package because it is a fact about gateways, and
// because two refund paths need the same answer: the returns flow in
// `@wizeworks/commerce` (return-service) and the order refund in api-rest. It
// was a private const in the first of those, so the second went on asking a
// DIFFERENT question and got a different answer for the same shop (persona
// issues 223, then 303).

/** The processors that hold a charge somewhere else. */
export const GATEWAY_PROCESSORS: ReadonlySet<string> = new Set(['stripe', 'paypal']);

/**
 * True when this payment can be reversed by calling a gateway.
 *
 * Ask this — never whether a `processorRef` happens to be filled in. A
 * reference alone is NOT proof there is a charge to reverse: the reference box
 * is free text, and a shop that takes cheques uses it for exactly what it looks
 * like ("Cheque 4471, banked Aug 25"). Reading that as a charge id sends a
 * cheque number to a payment gateway.
 */
export function takenByGateway(processor: string): boolean {
  return GATEWAY_PROCESSORS.has(processor);
}
