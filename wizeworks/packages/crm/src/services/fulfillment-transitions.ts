// When a delivery that was packed but not sent leaves (sparx persona issue 357).
//
// The pack bench seals a box as a `pending` delivery. Nothing could send it
// afterwards, so a box packed for Gillett's O-000008 sat "Being packed" for
// good, and the order's own "Mark it as sent" made a second delivery instead.

/** True when this change takes a packed box out of the door: `pending` before,
 *  `shipped` or `delivered` after. */
export function leftTheBuilding(before: string, after: string): boolean {
  return before === 'pending' && (after === 'shipped' || after === 'delivered');
}
