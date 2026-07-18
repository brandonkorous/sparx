'use client';

// Route-segment error boundary (docs/50 §4). Catches render/runtime errors below
// the root layout so a single broken page degrades to a recover-able message
// instead of a blank screen. Theme-agnostic: it inherits the page text color so
// it reads correctly in both light and dark storefronts.

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Surface to the console / server logs. A future error tracker hooks in here.
        console.error(error);
    }, [error]);

    return (
        <main className="min-h-[60vh] flex items-center justify-center p-12">
            <div className="text-base-content bg-base-100 max-w-md w-full text-center rounded-lg border p-10">
                <p className="text-primary uppercase tracking-widest text-sm font-mono font-semibold mb-3">
                    Something went wrong
                </p>
                <h1 className="text-[24px] font-semibold mb-2">This page didn&apos;t load</h1>
                <p className="text-[15px] leading-[1.6] opacity-70 mb-6">
                    An unexpected error stopped this page from loading. You can try again, or head back to the
                    store.
                </p>

                <div className="flex gap-3 justify-center items-center">
                    <button type="button" onClick={reset} className="btn btn-primary">
                        Try again
                    </button>
                    <a href="/" className="text-primary text-[14px] underline">
                        Go to homepage
                    </a>
                </div>

                {error.digest ? (
                    <p className="font-mono text-xs opacity-50 mt-6">Reference: {error.digest}</p>
                ) : null}
            </div>
        </main>
    );
}
