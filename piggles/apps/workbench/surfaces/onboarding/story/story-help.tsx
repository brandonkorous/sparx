'use client';

import { type ReactNode } from 'react';
import { faChevronDown, faPlus, faXmark } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Heading, Text } from '@wizeworks/silicaui-react';

// The legend that sits under the story canvas — a quiet key to the sentence's
// affordances, which are otherwise learn-by-poking. Each row leads with a facsimile
// of the REAL on-canvas control (a chip's chevron, the dashed + add-button, a clause's
// × remove) so the mapping from "the thing in the picture" to "what it does" is direct.
// It carries no state; it's pure guidance, so it lives beside the canvas as its own
// base-100 card — a second surface lifted on the same recessed onboarding canvas.

/** One legend row: the glyph facsimile + what that control does. */
function HelpRow({ glyph, children }: { glyph: ReactNode; children: ReactNode }): ReactNode {
    return (
        <li className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0">{glyph}</span>
            <Text className="text-sm leading-snug">{children}</Text>
        </li>
    );
}

export function StoryHelp(): ReactNode {
    return (
        <aside className="bg-base-100 border-base-300 flex flex-col gap-4 rounded-xl border p-6 @[48rem]:p-8">
            <div className="flex flex-col gap-1">
                <Heading level={3} className="text-base font-semibold">
                    Ways to shape your story
                </Heading>
                <Text className="text-sm">
                    There’s no wrong answer — it’s your story, not a form. Change anything, add as much as you
                    like, and your plan on the right keeps pace.
                </Text>
            </div>

            <ul className="flex flex-col gap-3">
                <HelpRow
                    glyph={
                        <span className="border-base-300 inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs font-medium">
                            phrase
                            <Icon glyph={faChevronDown} size={12} aria-hidden />
                        </span>
                    }
                >
                    <span className="font-medium">Tap any colored phrase</span> to swap it — pick a different
                    business, who it’s for, or how customers buy.
                </HelpRow>

                <HelpRow
                    glyph={
                        <span className="border-module text-module inline-flex size-6 items-center justify-center rounded-full border border-dashed">
                            <Icon glyph={faPlus} size={13} aria-hidden />
                        </span>
                    }
                >
                    <span className="font-medium">Tap a dashed +</span> to add another way people buy, or
                    another thing you do — each one switches on the module it needs.
                </HelpRow>

                <HelpRow
                    glyph={
                        <span className="bg-base-200 inline-flex size-6 items-center justify-center rounded-full">
                            <Icon glyph={faXmark} size={12} aria-hidden />
                        </span>
                    }
                >
                    <span className="font-medium">Remove anything with its ✕</span> — your story only carries
                    what you actually do, and dropping it drops that module from your plan.
                </HelpRow>
            </ul>
        </aside>
    );
}
