// A bordered base-100 tile — the app's KPI shape (mirrors reports.tsx). Value
// leads on scale and weight; the label sits under it in full ink, never faded.
// Shared by the orders row and the visits row on a customer's overview.
export function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-base-300 bg-base-100 flex flex-col gap-1 rounded-lg border p-3">
      <span className="text-sm">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {hint ? <span className="text-sm">{hint}</span> : null}
    </div>
  );
}
