import * as React from 'react';

/**
 * Persist a piece of tool state in localStorage so a return visit keeps your
 * business details, UTM history, etc. SSR-safe: the server and first client
 * render both use `initial` (no hydration mismatch); the stored value is read in
 * after mount.
 */
export function useLocalStorageState<T>(
  key: string,
  initial: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = React.useState<T>(initial);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) setState(JSON.parse(raw) as T);
    } catch {
      /* ignore malformed/blocked storage */
    }
    setLoaded(true);
  }, [key]);

  React.useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* ignore quota/blocked storage */
    }
  }, [key, state, loaded]);

  return [state, setState];
}
