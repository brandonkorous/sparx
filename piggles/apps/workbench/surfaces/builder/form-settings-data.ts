'use client';

// One form's routing settings — what it is called, who hears about a submission,
// and what the person who sent it gets back.
//
// WHY THIS FILE EXISTS. The whole server half of this shipped long ago:
// `FormDefinition` holds the config in columns a visitor never sees,
// `formDefinitionService` reads and writes it, and `/v1/forms/definitions/:id`
// exposes it behind editor-role + module gating. Nothing in the console reached
// any of it, so every form on every site was unnamed, notified whoever the
// account fallback happened to be, and could never send a confirmation reply
// (issue 355). The submissions inbox even blamed the owner for it — its own
// comment described an unnamed form as one "whose settings panel was never
// opened", and there was no panel to open.
//
// RECIPIENTS ARE THE REASON THIS IS SERVER-SIDE. They live in a column, never in
// the published tree, so the public submit endpoint reads them and no address
// can ever originate from a visitor. The route parses them as real addresses at
// the trust boundary. Nothing here weakens that: this is a form for the owner,
// authenticated like every other pane.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';

import { api } from '../../lib/api/client';

/** The routing config, exactly as `@wizeworks/builder-schemas` defines it. Only the
 *  fields this panel edits — the service normalizes and fills the rest, so a partial
 *  save stores a complete config rather than dropping what it did not send. */
export interface FormConfig {
  name: string;
  successMessage: string;
  notify: boolean;
  addToCrm: boolean;
  openDeal: boolean;
  autoresponder: boolean;
  autoresponderSubject: string;
  autoresponderMessage: string;
}

export interface FormDefinition {
  formNodeId: string;
  pageSlug: string | null;
  recipients: string[];
  config: FormConfig;
}

/** One form on this site, for the picker. `name` is null when the owner has not
 *  named it — which, before this panel existed, was all of them. */
export interface FormChoice {
  formNodeId: string;
  name: string | null;
  pageSlug: string | null;
}

export const formSettingsKeys = {
  list: () => ['builder', 'form-definitions'] as const,
  one: (formNodeId: string) => ['builder', 'form-definitions', formNodeId] as const,
};

export function useFormChoices() {
  return useQuery({
    queryKey: formSettingsKeys.list(),
    queryFn: () => api.get<{ forms: FormChoice[] }>('/v1/forms/definitions').then((r) => r.forms),
  });
}

export function useFormDefinition(formNodeId: string) {
  return useQuery({
    queryKey: formSettingsKeys.one(formNodeId),
    queryFn: () => api.get<FormDefinition>(`/v1/forms/definitions/${formNodeId}`),
    enabled: formNodeId !== '',
  });
}

export function useSaveFormDefinition(formNodeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { pageSlug: string | null; recipients: string[]; config: FormConfig }) =>
      api.put<FormDefinition>(`/v1/forms/definitions/${formNodeId}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: formSettingsKeys.list() });
      void queryClient.invalidateQueries({ queryKey: formSettingsKeys.one(formNodeId) });
      // The inbox prints the form's NAME, so a rename has to reach it too.
      void queryClient.invalidateQueries({ queryKey: ['builder', 'form-submissions'] });
    },
  });
}

/** How to name a form in a list: what the owner called it, else the page it sits on.
 *  Deliberately the same rule the submissions inbox uses (issue 353) so a form is
 *  called the same thing in both places. */
export function formChoiceLabel(choice: FormChoice): string {
  const name = choice.name?.trim() ?? '';
  if (name !== '') return name;
  const slug = choice.pageSlug?.trim() ?? '';
  return slug !== '' ? `/${slug}` : 'Home page';
}

/** One address per line, which is how a person writes a list of them. Blank lines
 *  and stray spaces are dropped rather than sent to the server to be rejected. */
export function parseRecipients(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/** The first address that is not one, for telling her which line to fix. Deliberately
 *  permissive — the server does the real validation, this only spares her a round
 *  trip and a 400 that names no line. */
export function firstInvalidRecipient(addresses: string[]): string | null {
  const shape = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;
  return addresses.find((address) => !shape.test(address)) ?? null;
}
