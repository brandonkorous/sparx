'use client';

// The legal-pages checklist — the policy documents a business is expected to
// publish, and where they link on the site.
//
// This is NOT a table. It is a short, fixed set of documents (privacy, terms,
// cookies, and — with commerce on — returns/shipping/refund), each of which is a
// one-line thing with a state and a next action. So it reads as a card per group
// (the ones you are required to have, then the optional extras) with a row per
// document, the document's own name as the content and one status badge on the
// right — never a grouped table inventing columns to justify itself.
//
// The surface owns three jobs: the checklist, instantiating a page from a
// starter template, and acknowledging that starter wording has been reviewed —
// plus managing the footer links (placements) at the bottom. It owns NO prose
// editor: a legal page is an ordinary content entry, so "Edit text" hands off to
// the one content editor the app already has (`cms.content.detail`). Building a
// second editor here would be building it twice.
//
// Everything here commits immediately (create, acknowledge, link, unlink), so
// there is no draft and no unsaved-work guard — each action is its own confirm or
// its own button, done in one click.

import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Card,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { faScaleBalanced } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { FormSection } from '../../components/form-section';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { contentErrorMessage } from './data';
import { ShippingPolicyNotice } from './shipping-policy-notice';
import { ChecklistRows } from './legal-checklist-rows';
import { PlacementsSection } from './legal-placements';
import {
  useAcknowledgeLegalPage,
  useTakeStarterWording,
  useInstantiateLegalPage,
  useLegalChecklist,
  useLegalPlacements,
  type ChecklistItem,
} from './legal-data';
import { productCopy } from '../../lib/product';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

/** Same modifier contract as every other list in the app — Shift alongside, Alt
 *  a new window. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function LegalListSurface({ ctx }: { ctx: SurfaceContext }) {
  const toast = useToast();
  const confirm = useConfirm();

  const checklist = useLegalChecklist();
  const placements = useLegalPlacements();

  const instantiate = useInstantiateLegalPage();
  const acknowledge = useAcknowledgeLegalPage();
  const takeStarter = useTakeStarterWording();

  const items = checklist.data?.items ?? [];
  const completeness = checklist.data?.completeness;
  const shipping = checklist.data?.shipping;
  const requiredItems = items.filter((item) => item.required);
  const optionalItems = items.filter((item) => !item.required);

  // Published pages still carrying a sentence the starter guessed for her.
  const guessingCount = items.filter((item) => (item.stillGuessing ?? []).length > 0).length;

  const allRequiredReady =
    completeness !== undefined &&
    completeness.requiredTotal > 0 &&
    completeness.requiredComplete === completeness.requiredTotal;

  const editText = (item: ChecklistItem, event: { shiftKey: boolean; altKey: boolean }) => {
    if (!item.entry) return;
    ctx.open('cms.content.detail', { id: item.entry.id }, { target: targetFor(event) });
  };

  const addPage = async (item: ChecklistItem) => {
    const ok = await confirm({
      title: `Add your ${item.title.toLowerCase()}?`,
      description: productCopy(
        'cms.legal.createHint',
        'This creates a private draft from a Piggles starter template, so you have something to work from rather than a blank page. The starter wording is a starting point, not legal advice — read it through and make it fit your business before you publish. It will also be linked in your site footer.'
      ),
      confirmLabel: 'Add it',
      cancelLabel: 'Cancel',
      color: 'module',
    });
    if (!ok) return;
    instantiate.mutate(item.legalKind, {
      onSuccess: () => {
        toast.add({
          title: `${item.title} added as a draft`,
          description: 'Read the starter wording, make it yours, then publish it.',
          type: 'success',
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not add this page',
          description: contentErrorMessage(error, 'Nothing was created.'),
          type: 'error',
        });
      },
    });
  };

  /**
   * Take the newer starter wording.
   *
   * The confirm has to say two different things because two different things are
   * at stake. A page she has never edited loses nothing. A page she HAS edited
   * loses her words from the live page — recoverable from the page's history,
   * which is why the sentence says so rather than just warning her off.
   */
  const takeWording = async (item: ChecklistItem) => {
    const entry = item.entry;
    if (!entry) return;
    const live = entry.status === 'published';
    const ok = await confirm({
      title: `Use the new wording for your ${item.title.toLowerCase()}?`,
      description: `Everything on this page is replaced with the current starter wording${
        live ? ', and your live page changes straight away' : ''
      }. What is on it now is kept in the page’s history, so you can get it back. You will need to read the new wording and mark it reviewed.`,
      confirmLabel: 'Use the new wording',
      cancelLabel: 'Leave it as it is',
      color: 'warning',
    });
    if (!ok) return;
    takeStarter.mutate(entry.id, {
      onSuccess: () => {
        toast.add({
          title: `${item.title} now uses the new wording`,
          description: 'Read it through and mark it reviewed.',
          type: 'success',
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not update the wording',
          description: contentErrorMessage(error, 'The page is unchanged.'),
          type: 'error',
        });
      },
    });
  };

  const acknowledgePage = async (item: ChecklistItem) => {
    if (!item.entry) return;
    const ok = await confirm({
      title: `Mark your ${item.title.toLowerCase()} as reviewed?`,
      description:
        'Confirm you have read the starter wording and made it fit your business. This is not legal advice — if you are unsure, check it with your own advisor. This only clears the “needs review” note; it does not publish the page.',
      confirmLabel: 'I have reviewed it',
      cancelLabel: 'Not yet',
      color: 'module',
    });
    if (!ok) return;
    acknowledge.mutate(item.entry.id, {
      onSuccess: () => {
        toast.add({ title: `${item.title} marked as reviewed`, type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not update this',
          description: contentErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Legal pages controls"
        status={
          completeness ? (
            <Badge
              color={allRequiredReady ? 'success' : 'info'}
              variant="soft"
              size="sm"
              className="whitespace-nowrap"
            >
              {allRequiredReady
                ? 'All required pages ready'
                : `${completeness.requiredComplete} of ${completeness.requiredTotal} required ready`}
            </Badge>
          ) : null
        }
        refresh={
          <RefreshButton
            isFetching={checklist.isFetching}
            updatedAt={checklist.data ? checklist.dataUpdatedAt : undefined}
            onRefresh={() => {
              void checklist.refetch();
            }}
          />
        }
      />

      <Card className="min-h-0 flex-1 overflow-y-auto">
        {checklist.isError ? (
          <PaneLoadError
            icon={<Icon glyph={faScaleBalanced} className="size-6" aria-hidden />}
            title="Could not load your legal pages"
            description="This is a problem reaching the server. None of your pages are affected — nothing has been lost."
            onRetry={() => {
              void checklist.refetch();
            }}
          />
        ) : checklist.isPending ? (
          <PaneWaiting />
        ) : (
          <div className="p-3 @lg:p-4">
            <div className={COLUMN}>
              <Text>
                The policy pages people expect to find on your site. Add each one from a starter
                template, make the wording fit your business, then publish it.
              </Text>

              {completeness ? (
                <Alert
                  color={allRequiredReady && guessingCount === 0 ? 'success' : 'info'}
                  variant="soft"
                >
                  <AlertContent>
                    <AlertTitle>
                      {allRequiredReady
                        ? 'Your required pages are all set'
                        : `${completeness.requiredComplete} of ${completeness.requiredTotal} required pages ready`}
                    </AlertTitle>
                    <AlertDescription>
                      {allRequiredReady
                        ? 'Every page you are expected to have is published, up to date, and linked in your footer.'
                        : 'A page counts as ready once it is published, built on the latest starter wording, and linked in your footer.'}
                      {/* "Ready" counts publishing, not reading. Sitting a green
                          banner above three pages that still carry our guesses is
                          how an owner stops here — so it says so (issue 375). */}
                      {guessingCount > 0
                        ? ` ${String(guessingCount)} of them ${guessingCount === 1 ? 'still says' : 'still say'} things we guessed about your business — they are marked below.`
                        : ''}
                    </AlertDescription>
                  </AlertContent>
                </Alert>
              ) : null}

              {shipping?.missingPolicy ? <ShippingPolicyNotice because={shipping.because} /> : null}

              {requiredItems.length > 0 ? (
                <FormSection
                  title="Pages you should have"
                  description="These are the policies a business like yours is normally expected to publish."
                >
                  <ChecklistRows
                    items={requiredItems}
                    onAdd={(item) => {
                      void addPage(item);
                    }}
                    onEdit={editText}
                    onAcknowledge={(item) => {
                      void acknowledgePage(item);
                    }}
                    addingKind={instantiate.isPending ? instantiate.variables : undefined}
                    onTakeWording={(item) => {
                      void takeWording(item);
                    }}
                    acknowledgingId={acknowledge.isPending ? acknowledge.variables : undefined}
                    takingWordingId={takeStarter.isPending ? takeStarter.variables : undefined}
                  />
                </FormSection>
              ) : null}

              {optionalItems.length > 0 ? (
                <FormSection
                  title="Optional pages"
                  description="Helpful to have, but not required. Add one if it fits how you do business."
                >
                  <ChecklistRows
                    items={optionalItems}
                    onAdd={(item) => {
                      void addPage(item);
                    }}
                    onEdit={editText}
                    onAcknowledge={(item) => {
                      void acknowledgePage(item);
                    }}
                    addingKind={instantiate.isPending ? instantiate.variables : undefined}
                    onTakeWording={(item) => {
                      void takeWording(item);
                    }}
                    acknowledgingId={acknowledge.isPending ? acknowledge.variables : undefined}
                    takingWordingId={takeStarter.isPending ? takeStarter.variables : undefined}
                  />
                </FormSection>
              ) : null}

              <PlacementsSection ctx={ctx} items={items} placements={placements} />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
