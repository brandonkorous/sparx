/** The least glamorous thing a brand has to survive, and the one every business
 *  sends most often. A palette that only works on a hero is half a palette. */
const LINES: [string, string, string][] = [
  ['Kitchen fit — cabinetry', '1', '$3,400.00'],
  ['Worktop, installed', '1', '$1,150.00'],
  ['Waste removal', '2', '$180.00'],
];

export function InvoiceScene() {
  return (
    <div className="bg-[var(--pal-base-100)] px-6 py-8 text-[var(--pal-base-content)] sm:px-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-5 rounded-full bg-[var(--pal-primary)]" />
            <span className="text-lg font-extrabold">Ridley Joinery</span>
          </div>
          <p className="mt-1 text-base text-[var(--pal-quiet)]">22 Mill Lane · 0400 118 226</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold">Invoice 0142</p>
          <span className="rounded-selector mt-2 inline-block bg-[var(--pal-accent)] px-3 py-1 text-xs font-bold text-[var(--pal-accent-content)]">
            Due in 14 days
          </span>
        </div>
      </div>

      <table className="mt-8 w-full text-left">
        <thead>
          <tr className="bg-[var(--pal-secondary)] text-[var(--pal-secondary-content)]">
            <th className="rounded-l-field px-3 py-2 text-base font-bold">Work</th>
            <th className="px-3 py-2 text-right text-base font-bold">Qty</th>
            <th className="rounded-r-field px-3 py-2 text-right text-base font-bold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {LINES.map(([what, qty, amount]) => (
            <tr key={what} className="border-b border-[var(--pal-line)]">
              <td className="px-3 py-3 text-base">{what}</td>
              <td className="px-3 py-3 text-right text-base">{qty}</td>
              <td className="px-3 py-3 text-right text-base font-semibold">{amount}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <span className="rounded-field bg-[var(--pal-primary)] px-5 py-3 text-base font-bold text-[var(--pal-primary-content)]">
          Pay this invoice
        </span>
        <p className="text-right">
          <span className="block text-base text-[var(--pal-quiet)]">Total including tax</span>
          <span className="block text-3xl font-extrabold">$5,192.00</span>
        </p>
      </div>
    </div>
  );
}
