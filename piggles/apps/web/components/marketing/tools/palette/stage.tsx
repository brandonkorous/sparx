'use client';

import { useRef, useState } from 'react';
import { SwatchColumn } from './swatch-column';
import { ContentCell } from './content-cell';
import { contentFor, roleAt, type Assignment, type ContentInk, type Role } from './roles';
import type { Vision } from './vision';
import { MIN_SWATCHES, type Palette } from './model';

/** Where the pointer is, in slot numbers. Live-reordering as you drag is the
 *  whole feel of this — a placeholder that only commits on release makes you
 *  imagine the result instead of seeing it. */
function slotAt(container: HTMLElement, x: number, y: number): number {
    const rects = [...container.children].map((c) => c.getBoundingClientRect());
    if (rects.length < 2) return 0;

    const horizontal =
        Math.abs(rects[1]!.left - rects[0]!.left) > Math.abs(rects[1]!.top - rects[0]!.top);
    const pos = horizontal ? x : y;

    const found = rects.findIndex((r) =>
        horizontal ? pos < r.left + r.width / 2 : pos < r.top + r.height / 2
    );
    return found === -1 ? rects.length - 1 : found;
}

export function Stage({
    palette,
    roles,
    ink,
    vision,
    onCopy,
    onLock,
    onChange,
    onRemove,
    onReorder,
    onDragStart,
    onDragEnd,
    onInk,
    onResetInk,
}: {
    palette: Palette;
    /** The resolved theme, so each slot can show the ink that goes on it. */
    roles: Assignment;
    /** Inks the visitor has overridden — the rest are silica's to work out. */
    ink: ContentInk;
    vision: Vision;
    onCopy: (hex: string) => void;
    onLock: (id: string) => void;
    onChange: (id: string, hex: string) => void;
    onRemove: (id: string) => void;
    onReorder: (from: number, to: number) => void;
    onDragStart: () => void;
    onDragEnd: () => void;
    onInk: (role: Role, hex: string) => void;
    onResetInk: (role: Role) => void;
}) {
    const container = useRef<HTMLDivElement>(null);
    const from = useRef<number | null>(null);
    const [dragging, setDragging] = useState<string | null>(null);

    const grab = (index: number, id: string) => (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0 || palette.length < 2) return;
        // Suppress the browser's own text selection. A drag that travels past the
        // stage otherwise highlights whatever prose it crosses on the way, and the
        // person is left with half the page selected after dropping a color.
        e.preventDefault();
        from.current = index;
        setDragging(id);
        onDragStart();
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const drag = (e: React.PointerEvent<HTMLDivElement>) => {
        if (from.current === null || !container.current) return;
        const to = slotAt(container.current, e.clientX, e.clientY);
        if (to !== from.current) {
            onReorder(from.current, to);
            from.current = to;
        }
    };

    const drop = () => {
        if (from.current === null) return;
        from.current = null;
        setDragging(null);
        onDragEnd();
    };

    return (
        <div
            ref={container}
            onPointerMove={drag}
            onPointerUp={drop}
            onPointerCancel={drop}
            role="list"
            aria-label="Your palette"
            className="rounded-section flex overflow-hidden shadow-xl max-lg:flex-col lg:h-[clamp(22rem,56vh,34rem)]"
        >
            {palette.map((swatch, i) => {
                const role = roleAt(i);
                return (
                    <SwatchColumn
                        key={swatch.id}
                        swatch={swatch}
                        role={role}
                        ink={role ? contentFor(role, roles).hex : null}
                        foot={
                            <ContentCell
                                role={role}
                                roles={roles}
                                vision={vision}
                                overridden={Boolean(role && ink[role])}
                                onChange={onInk}
                                onReset={onResetInk}
                            />
                        }
                        vision={vision}
                        removable={palette.length > MIN_SWATCHES}
                        dragging={dragging === swatch.id}
                        onGrab={grab(i, swatch.id)}
                        onCopy={() => onCopy(swatch.hex)}
                        onLock={() => onLock(swatch.id)}
                        onChange={(hex) => onChange(swatch.id, hex)}
                        onRemove={() => onRemove(swatch.id)}
                    />
                );
            })}
        </div>
    );
}
