// The create-barcodes button's words (persona issue 273).

/** "Create 200 of 693 barcodes" when the button covers part of the list, so the
 *  number on it agrees with the number in the sentence above it. */
export function createBarcodesLabel(count: number, outOf?: number): string {
  if (outOf !== undefined && outOf > count) {
    return `Create ${String(count)} of ${String(outOf)} barcodes`;
  }
  return `Create ${String(count)} ${count === 1 ? 'barcode' : 'barcodes'}`;
}
