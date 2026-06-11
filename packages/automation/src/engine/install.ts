// One-shot registration of the engine's built-in resolvers + action executors.
//
// Every engine entry point (handleTrigger, the ticks, tests) calls this first;
// both installers are idempotent, so repeated calls are free. Module-owned
// resolvers/actions register separately where the engine is wired with their
// service packages (the worker / seed path).

import { installBuiltinActions } from '../actions/builtins';
import { installBuiltinResolvers } from '../resolvers/builtins';

export function installBuiltins(): void {
  installBuiltinResolvers();
  installBuiltinActions();
}
