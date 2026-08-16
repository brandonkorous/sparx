'use client';

import { parseHex, ramp, RAMP_STEPS, readableInk, toHex } from '../lib/color';
import { seenAs, type Vision } from './vision';

/**
 * One color, in every strength it will ever need.
 *
 * This is the step most palette tools leave out and every real project needs
 * within an hour: a pale one for the background, the chosen one for the button,
 * a darker one for the moment somebody presses it. Clicking a step promotes it
 * to the swatch, so "nearly right, a bit deeper" is one tap instead of a trip to
 * a color wheel.
 */
export function ShadeRail({
    hex,
    vision,
    onPick,
}: {
    hex: string;
    vision: Vision;
    onPick: (hex: string) => void;
}) {
    const rgb = parseHex(hex);
    if (!rgb) return null;
    const scale = ramp(rgb);

    return (
        <div className="absolute inset-0 flex flex-col max-lg:flex-row">
            {RAMP_STEPS.map((step) => {
                const value = scale[step];
                const shown = seenAs(value, vision);
                const ink = toHex(readableInk(parseHex(shown)!));
                return (
                    <button
                        key={step}
                        type="button"
                        onClick={() => onPick(value)}
                        title={`${step} — ${value}`}
                        className="flex flex-1 items-center justify-center text-xs font-bold transition-[flex] duration-150 hover:flex-[1.7] focus-visible:flex-[1.7] focus-visible:outline-none"
                        style={{ backgroundColor: shown, color: ink }}
                    >
                        {step}
                    </button>
                );
            })}
        </div>
    );
}
