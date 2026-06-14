import * as React from 'react';

// Returns `value` delayed to the trailing edge of a burst of changes. The
// standard way to feed a fast-changing input (a search box) into an expensive
// consumer (a network query key) without firing on every keystroke.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}
