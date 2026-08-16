'use client';

export interface ChipOption {
    value: string;
    label: string;
    /** Sets the chip's hue when selected. Omitted for "All". */
    group?: string;
    count: number;
}

/** The chips carry their own group color when chosen, so filtering to Money
 *  turns the control olive — the same hue those tools wear everywhere else. */
export function FilterChips({
    options,
    value,
    onChange,
}: {
    options: ChipOption[];
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by what it is for">
            {options.map((option) => {
                const on = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        data-group={option.group}
                        aria-pressed={on}
                        onClick={() => onChange(option.value)}
                        className={`rounded-selector border px-4 py-2 text-base font-semibold transition-colors duration-150 outline-none motion-reduce:transition-none ${on
                                ? 'bg-module text-module-content border-module'
                                : 'border-base-300 hover:border-module'
                            }`}
                    >
                        {option.label}
                        <span className="ml-2 opacity-70">{option.count}</span>
                    </button>
                );
            })}
        </div>
    );
}
