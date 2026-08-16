'use client';

// The theme of the DOCUMENT a component is painting into — 'light' | 'dark'.
//
// Reads `data-theme` off that document's root and re-reads it live, so anything
// that must know the theme without a prop threaded down (a loading fallback deep
// in a Suspense boundary, a brand mascot picking its face color) stays correct
// — including in a detached popout, which is a different `document` entirely.
//
// This is the read-only counterpart to lib/theme.ts, which WRITES the attribute
// (applyThemeToDocument) and broadcasts changes over the bus. A theme toggle
// there sets data-theme here, the observer fires, and the face flips in step.

import { useCallback, useSyncExternalStore } from 'react';

export function useDocumentTheme(): 'light' | 'dark' {
    const subscribe = useCallback((onChange: () => void) => {
        const observer = new MutationObserver(onChange);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme'],
        });
        return () => {
            observer.disconnect();
        };
    }, []);

    return useSyncExternalStore(
        subscribe,
        () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'),
        // Server render can't know the persisted choice; the pre-paint theme script
        // has already set the attribute before this ever mounts on the client.
        () => 'light'
    );
}
