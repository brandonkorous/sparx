import { ConsoleEntry } from './console-entry';

// The console root: your workspace, exactly as you left it, with no destination
// asked for. Every OTHER address lands on the catch-all beside this file and
// renders the same shell — see app/[...path]/page.tsx and app/console-entry.tsx.
export const dynamic = 'force-dynamic';

export default function ConsolePage() {
  return <ConsoleEntry address="/" />;
}
