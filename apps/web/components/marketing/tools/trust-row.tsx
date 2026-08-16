import { Text } from '@wizeworks/silicaui-react';

/**
 * The reassurance row shared by the hub and every tool page.
 *
 * The whole pitch of this surface is "these don't suck", and the reason the
 * online ones do is uploads, sign-up walls, and watermarks. So this is the same
 * device /pricing and /features open with — a counter-assumption row, each entry
 * answering a cost the reader has already assumed is coming. It is not decoration
 * and it should not read as a caption.
 *
 * It used to render as three 14px labels with 15px icons, tucked under the hero
 * copy — the most load-bearing claims on the page, set smaller than the page's
 * body text. They are metrics now, at metric size, under a rule, which is where
 * a reader looks for exactly this kind of fact.
 *
 * The `tone` prop is gone with the colored bands that needed it. Both surfaces
 * are the dark island now, so the ink resolves from the band's own `-content`
 * and there is nothing left to switch on.
 */
const TRUST = [
    {
        v: 'In your browser',
        s: 'Every one of these runs on your own machine.',
    },
    {
        v: 'Nothing uploaded',
        s: 'Your file, logo and text never leave the tab.',
    },
    {
        v: 'No sign-up',
        s: 'No account, no email, no watermark on the way out.',
    },
] as const;

export function TrustRow({ className }: { className?: string }) {
    return (
        <ul
            className={[
                'border-base-300 m-0 grid list-none grid-cols-1 gap-x-10 gap-y-8 border-t p-0 pt-10 sm:grid-cols-3',
                className,
            ]
                .filter(Boolean)
                .join(' ')}
        >
            {TRUST.map((item) => (
                <li key={item.v} className="flex flex-col gap-1.5">
                    <span className="text-3xl font-medium tracking-[-0.02em] sm:text-4xl">{item.v}</span>
                    <Text className="text-lg leading-snug">{item.s}</Text>
                </li>
            ))}
        </ul>
    );
}
