// What pressing "Use this starting point" has to do, given what is already there.
//
// Pure, so the three cases that went wrong are pinned by a test (sparx persona
// issue 294):
//
//  - A business can hold an install the setup never made: every home workspace is
//    given the starter design before its owner opens setup, so the setup's own
//    record is empty. Installing that design again is refused ("already
//    installed"), and setup stopped on the starting point.
//  - Changing only "Bring its examples" has to replace the install, because the
//    answer is fixed when the design goes in; the old one has to go first or the
//    new one is refused the same way.
//  - Switching designs removed the old one through a route that no longer existed,
//    and the failure was swallowed, so both designs' pages and products stayed.

/** One install, as `GET /v1/blueprints/installs` lists it. */
export interface InstallSummary {
  id: string;
  blueprint_key: string;
  status: string;
  sample_data: boolean;
}

/** The setup's own record of what it installed. */
export interface SetupTemplateState {
  blueprintKey: string | null;
  installId: string | null;
  sampleData?: boolean;
}

export type TemplatePlan =
  /** It is already there with the same answer: use it as it is. */
  | { kind: 'keep'; installId: string }
  /** Install the choice, after removing `remove` (an install id) when set. */
  | { kind: 'install'; remove: string | null };

/** Installs that are in place, as opposed to failed or replaced ones. */
function inPlace(install: InstallSummary): boolean {
  return install.status === 'installed' || install.status === 'live';
}

export function planTemplateInstall(
  state: SetupTemplateState,
  installs: readonly InstallSummary[],
  choice: { key: string; sampleData: boolean }
): TemplatePlan {
  // The setup's own install, when it made one; else an install of the same design
  // that got there another way, in any state: the server refuses a second install
  // of a design while ANY row for it remains ("A previous install is failed.
  // Delete it, then install again."). Another design the setup did not make is
  // left alone: it is not the setup's to remove.
  const own = state.installId ? (installs.find((i) => i.id === state.installId) ?? null) : null;
  const current = own ?? installs.find((i) => i.blueprint_key === choice.key) ?? null;

  if (!current) return { kind: 'install', remove: null };
  if (
    current.blueprint_key === choice.key &&
    inPlace(current) &&
    current.sample_data === choice.sampleData
  ) {
    return { kind: 'keep', installId: current.id };
  }
  return { kind: 'install', remove: current.id };
}
