// A one-time install that only counts as done once it IS done.
//
// ---------------------------------------------------------------------------
// The bug this exists for
// ---------------------------------------------------------------------------
//
// Every action module guarded itself the same way:
//
//     let installed = false;
//     export function installCrmActions(): void {
//       if (installed) return;
//       installed = true;        // ← set BEFORE the work
//       registerAction({ type: 'crm.add_tag',     … });
//       registerAction({ type: 'crm.create_task', … });
//       …
//     }
//
// The flag is set first, so if anything after it throws, the module is left
// PART registered and marked done. Every later call returns immediately. The
// process then runs for the rest of its life with a registry missing whatever
// came after the throw, and nothing anywhere says so — the next automation to
// use one of those actions simply fails with "no executor registered for
// action", which reads like a missing feature rather than a broken boot.
//
// Measured on this platform, 2026-09-16: 73 failed automation runs across 4
// tenants, and 71 of them are that exact message. The telling part is that the
// SAME action type both works and fails — `crm.create_task` has 446 completed
// steps and 8 failed, `email.send_campaign` 46 and 35 — which is not what a
// missing executor looks like. It is what a process that booted badly looks
// like. One shop's returns screen was the visible end of it: four approved
// returns, four runs, four failures, and the customer never told (persona issue
// 540).
//
// Ten places had this shape, including the engine's own `ensureEngineInstalled`.
//
// ---------------------------------------------------------------------------
// The rule
// ---------------------------------------------------------------------------
//
// Latch on SUCCESS, never on attempt. A throw leaves the flag down, so the next
// caller tries again and either succeeds or fails loudly every time. Both of
// those are recoverable; a silent half-registry is not.

/**
 * Wraps a setup function so it runs at most once SUCCESSFULLY.
 *
 * Idempotent like the flags it replaces: repeat calls after a success do
 * nothing. Unlike them, a call that throws is not remembered, so the work is
 * retried rather than abandoned half-done.
 *
 * Synchronous on purpose. Every caller registers descriptors into an in-memory
 * map, so there is no await to interleave on, and keeping it synchronous means
 * there is no window where two callers could both be inside the body.
 */
export function installOnce(setup: () => void): () => void {
  let done = false;
  return () => {
    if (done) return;
    setup();
    // Only now. If `setup` threw, the next caller gets to try again.
    done = true;
  };
}
