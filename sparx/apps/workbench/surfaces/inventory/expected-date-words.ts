/** What a blank "Expected" box becomes when the order is placed, for the supplier
 *  chosen. It promised a lead time the supplier did not have (persona issue 257). */
export function expectedDateHelp(
  supplier: { name: string; leadTimeDays: number | null } | null
): string {
  if (!supplier) return 'When you expect it.';
  const { name, leadTimeDays } = supplier;
  if (leadTimeDays === null) {
    return `When you expect it. ${name} has no usual delivery time, so left blank the order has no expected date.`;
  }
  const days = leadTimeDays === 1 ? '1 day' : `${leadTimeDays} days`;
  return `When you expect it. Left blank, it is set ${days} after you place the order: ${name}’s usual time.`;
}
