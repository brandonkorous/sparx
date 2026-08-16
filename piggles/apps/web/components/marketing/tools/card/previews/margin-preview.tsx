/** The sum, as the tool answers it. */
export function MarginPreview() {
  return (
    <div className="w-full text-center">
      <p className="text-4xl font-extrabold">$22.73</p>
      <p className="mt-1 text-base">charge, for a 45% margin</p>
      <div className="mt-3 flex justify-center gap-5 text-sm">
        <span>
          cost <strong className="font-mono">$12.50</strong>
        </span>
        <span>
          markup <strong className="font-mono">81.8%</strong>
        </span>
      </div>
    </div>
  );
}
