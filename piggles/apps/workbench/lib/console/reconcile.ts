'use client';

// Making "every app is included" true, not just written down.
//
// Piggles has no module pricing (RULE #2), so a Piggles business with a module
// off is never a customer who declined it — it is a provisioning gap, and every
// screen behind it is a locked door on a product that promises none. Marta's
// business had `builder` off, which is why My Site was simply missing.
//
// Provisioning is where this SHOULD be settled, and it is: api-rest furnishes a
// new tenant with every module. This catches the ones that slipped through
// before that was true, so nobody has to run a script against production to fix
// somebody's workspace. The endpoint is idempotent and refuses any brand that
// bills per module, so the worst case is a wasted request.

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@sparx/query';
import { api } from '@/lib/api/client';
import { useModuleStates, useViewer } from '@/lib/api/shell-data';

export function useModuleReconcile(): void {
  const { data: states } = useModuleStates();
  const { data: viewer } = useViewer();
  const queryClient = useQueryClient();
  // Once per page load. The states refetch after a successful repair, and
  // without this that would re-enter and ask again.
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current || !states || !viewer) return;
    // Owner/admin only, matching the route. Anyone else would just collect a 403
    // on every load.
    if (viewer.role !== 'owner' && viewer.role !== 'admin') return;
    if (!states.some((state) => !state.enabled)) return;

    asked.current = true;
    void api
      .post<{ activated: string[] }>('/v1/tenant/modules/reconcile', {})
      .then(async (result) => {
        if (result.activated.length === 0) return;
        await queryClient.invalidateQueries({ queryKey: ['tenant', 'modules'] });
      })
      .catch(() => {
        // Silent on purpose: this is a repair nobody asked for, and a toast about
        // it would be reporting an internal detail as the person's problem.
      });
  }, [states, viewer, queryClient]);
}
