// The console voice provider — logs instead of dialling.
//
// The default everywhere a real vendor is not configured, which means local
// development and every tenant that has not brought their own credentials. The
// point is that the WHOLE path still runs: a call is recorded against the
// record, the timeline entry appears, the activity is written. Only the ringing
// is missing, so a developer exercises the same code a customer will.

import type { CallResult, CallStatusUpdate, PlaceCallParams, VoiceProvider } from '../provider';

export class ConsoleVoiceProvider implements VoiceProvider {
  readonly id = 'console';
  readonly name = 'Console (development)';

  place(params: PlaceCallParams): Promise<CallResult> {
    // Intentional console.log — this is the wire boundary, not application code.
    console.log(
      '[voice:console]',
      JSON.stringify({ to: params.to, from: params.from, bridgeTo: params.bridgeTo })
    );
    return Promise.resolve({
      success: true,
      // Prefixed so a console-placed call is obvious in the database rather than
      // looking like a real provider id nobody can find in a vendor dashboard.
      providerCallId: `console-${Date.now().toString(36)}`,
    });
  }

  parseStatus(): CallStatusUpdate | null {
    // Nothing calls back in development; the person logs the outcome by hand,
    // which is the same thing they do for a call made from a desk phone.
    return null;
  }
}
