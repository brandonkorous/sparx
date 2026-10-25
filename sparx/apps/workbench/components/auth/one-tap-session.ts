// Google's One Tap library, initialised once per page and per client id.
//
// GSI warns "initialize() is called multiple times" and can refuse the prompt when
// it is. The component re-ran its effect whenever a parent re-rendered with a new
// `onError`, so this module owns the one initialise call; a remount only prompts.

export interface GoogleCredentialResponse {
  credential: string;
}

export interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }): void;
  prompt(): void;
  cancel(): void;
}

let initializedFor: string | null = null;
let onCredential: ((idToken: string) => void) | null = null;

/** Initialise once for `clientId`, route credentials to the newest handler, prompt. */
export function startOneTap(
  api: GoogleIdApi,
  clientId: string,
  handler: (idToken: string) => void
): void {
  onCredential = handler;
  if (initializedFor !== clientId) {
    api.initialize({
      client_id: clientId,
      callback: (response) => onCredential?.(response.credential),
      cancel_on_tap_outside: false,
    });
    initializedFor = clientId;
  }
  api.prompt();
}

/** For tests: forget the page's initialise call. */
export function resetOneTapForTests(): void {
  initializedFor = null;
  onCredential = null;
}
