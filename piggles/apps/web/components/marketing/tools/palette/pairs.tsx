'use client';

import { Card, CardBody, Tooltip } from '@wizeworks/silicaui-react';
import { faCheck, faCircleHalfStroke, faXmark } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { contrastRatio } from '../lib/color';
import { rgbOf, type Palette } from './model';
import { seenAs, type Vision } from './vision';

/**
 * Every pairing, measured.
 *
 * This is the question a palette actually has to answer — not "do these look
 * nice together" but "can I put this one's text on that one's background". Five
 * colors make twenty pairings and typically three or four of them work; finding
 * that out here takes a glance, and finding it out later takes a redesign.
 */
export function Pairs({ palette, vision }: { palette: Palette; vision: Vision }) {
    const grid = palette.map((bg) => palette.map((fg) => contrastRatio(rgbOf(fg), rgbOf(bg))));
    const usable = grid.flat().filter((r) => r >= 4.5).length;
    const total = palette.length * (palette.length - 1);

    return (
        <Card>
            <CardBody>
                <h3 className="text-2xl font-extrabold">What can be read on what</h3>
                <p className="text-base">
                    {usable === 0
                        ? 'None of these can carry another as text. That is normal for a set of similar tones, and it means the writing on your site wants a near-black or a near-white rather than one of these.'
                        : `${usable} of the ${total} pairings are readable at any size. Down the side is the background; across the top is the text sitting on it.`}
                </p>

                <div className="overflow-x-auto">
                    <div className="flex w-max flex-col gap-1">
                        <div className="flex gap-1">
                            <span className="w-6 shrink-0" />
                            {palette.map((fg) => (
                                <Chip key={fg.id} hex={fg.hex} vision={vision} label={`Text in ${fg.hex}`} across />
                            ))}
                        </div>

                        {palette.map((bg, row) => (
                            <Row
                                key={bg.id}
                                palette={palette}
                                ratios={grid[row]!}
                                bg={bg}
                                row={row}
                                vision={vision}
                            />
                        ))}
                    </div>
                </div>
            </CardBody>
        </Card>
    );
}

function Chip({
    hex,
    vision,
    label,
    across,
}: {
    hex: string;
    vision: Vision;
    label: string;
    across?: boolean;
}) {
    return (
        <span
            aria-label={label}
            className={`border-base-300 shrink-0 rounded-full border ${across ? 'h-6 w-14' : 'h-14 w-6'}`}
            style={{ backgroundColor: seenAs(hex, vision) }}
        />
    );
}

function Row({
    palette,
    ratios,
    bg,
    row,
    vision,
}: {
    palette: Palette;
    ratios: number[];
    bg: Palette[number];
    row: number;
    vision: Vision;
}) {
    return (
        <div className="flex gap-1">
            <Chip hex={bg.hex} vision={vision} label={`Background ${bg.hex}`} />
            {palette.map((fg, col) =>
                // A color on itself. Rendering it like any other cell draws invisible
                // text and reads as a hole in the grid, so it says outright that there
                // is nothing here to measure.
                col === row ? (
                    <span
                        key={fg.id}
                        aria-hidden
                        className="rounded-field border-base-300 flex h-14 w-14 shrink-0 items-center justify-center border border-dashed text-base font-bold"
                    >
                        &mdash;
                    </span>
                ) : (
                    <Cell key={fg.id} bg={bg.hex} fg={fg.hex} ratio={ratios[col]!} vision={vision} />
                )
            )}
        </div>
    );
}

function Cell({
    bg,
    fg,
    ratio,
    vision,
}: {
    bg: string;
    fg: string;
    ratio: number;
    vision: Vision;
}) {
    const verdict = ratio >= 4.5 ? 'any size' : ratio >= 3 ? 'headings only' : 'not readable';

    return (
        <Tooltip content={`${fg} on ${bg} — ${ratio.toFixed(1)}:1, ${verdict}`}>
            <div
                className="rounded-field flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-1"
                style={{ backgroundColor: seenAs(bg, vision), color: seenAs(fg, vision) }}
            >
                <span className="text-lg leading-none font-bold">Aa</span>
                {/* Three outcomes, three glyphs. A half-filled circle is "headings only"
            — the middle band is the one people get wrong, so it gets its own
            mark rather than being rounded up to a tick or down to a cross. */}
                <Icon
                    glyph={ratio >= 4.5 ? faCheck : ratio >= 3 ? faCircleHalfStroke : faXmark}
                    aria-hidden
                    className="size-3"
                />
            </div>
        </Tooltip>
    );
}
