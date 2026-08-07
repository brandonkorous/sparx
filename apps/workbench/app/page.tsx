import { WorkbenchEntry } from './workbench-entry';

// The workbench root: your layout, exactly as you left it, with no destination
// asked for. Every OTHER address lands on the catch-all beside this file and
// renders the same shell — see app/[...path]/page.tsx and app/workbench-entry.tsx.
export const dynamic = 'force-dynamic';

export default function WorkbenchPage() {
  return <WorkbenchEntry address="/" />;
}
