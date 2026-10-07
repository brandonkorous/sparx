'use client';

// One web address — connect it, prove you own it, make it the main one, remove it.
//
// Connect and manage are the same surface because connecting does not finish the
// job: it creates a PENDING address whose records still have to be added at a
// domain provider, and this pane is what you come back to until it goes live.
// The `id === 'new'` branch is just this pane before the address exists.
//
// Deliberately NOT built on `EditorLayout`. That chassis is a form with a
// completion order and a running summary beside it; this pane is a status, two
// values to copy, and two facts. Run through the bento it produced a near-empty
// rail floating next to a near-empty main column, with the records — the entire
// point of the screen — as the smallest thing on it. So: one centred column,
// the address as the identity, and the records as the hero.
//
// The audience owns a business, not a network. Nothing here says "A record",
// "apex", "propagation" or "TTL" without saying what it means in the same
// breath, each record is labelled with what it DOES rather than what it is, and
// the values are presented as things to copy rather than things to understand.

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  Input,
  Select,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { ExternalLink, Link2, RefreshCw, Star, Trash2 } from 'lucide-react';
import { CopyValue } from '../../components/copy-value';
import { useActivePropertyId } from '../../lib/api/shell-data';
import { useDirtySource } from '../../lib/workbench/dirty';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { afterPaneChange } from '../../lib/defer';
import { FormSection } from '../../components/form-section';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useSites } from '../sites/data';
import { SaveFailure } from '@/components/save-failure';
import {
  domainErrorMessage,
  domainState,
  useConnectDomain,
  useDisconnectDomain,
  useDomain,
  useDomains,
  useMakeCanonical,
  useReissueVerification,
  useVerifyDomain,
  type DnsRecord,
  type Domain,
} from './data';
import { productName } from '../../lib/product';
import { PaneLoadError } from '../../components/pane-load-error';

/** The one column everything in this pane sits in. Centred and capped, because a
 *  pane torn onto a second monitor is otherwise 2000px of dead grey with a
 *  paragraph pinned to the left edge. */
const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

/**
 * One DNS record as a labelled block rather than a table row.
 *
 * A three-column table puts two long, unbreakable strings side by side, which is
 * unreadable the moment the pane is anything less than full width — and panes
 * here are routinely half a screen. Stacked and labelled, it survives any width
 * and each value gets room to breathe.
 *
 * `purpose` says what the record DOES. "CNAME" means nothing to someone who
 * bought a domain once; "sends visitors to your site" means everything.
 */
function RecordBlock({
  kind,
  purpose,
  record,
}: {
  kind: string;
  purpose: string;
  record: DnsRecord;
}) {
  return (
    <div className="border-base-300 flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* COLORLESS, not `neutral`. A DNS record type carries no meaning to
            color and naming grey is not a choice this file may make (RULE #4).
            The value itself is right as it stands: TXT and CNAME are what the
            person's domain provider will call them too. */}
        <Badge variant="outline" size="sm">
          {kind}
        </Badge>
        <Text className="text-sm">{purpose}</Text>
      </div>
      <div className="grid gap-2 @md:grid-cols-[4.5rem_minmax(0,1fr)] @md:items-center">
        <Text className="text-sm font-semibold">Name</Text>
        <CopyValue value={record.name} label={`${kind} name`} />
        <Text className="text-sm font-semibold">Value</Text>
        <CopyValue value={record.value} label={`${kind} value`} />
      </div>
    </div>
  );
}

function ConnectDomain({ ctx }: { ctx: SurfaceContext }) {
  const toast = useToast();
  const { data: sites } = useSites();
  const currentSiteId = useActivePropertyId();
  const connect = useConnectDomain();

  const [host, setHost] = useState('');
  const [propertyId, setPropertyId] = useState('');

  useEffect(() => {
    ctx.setTitle('Connect a domain');
  }, [ctx]);

  // Defaults to the site being worked in, which is nearly always the one meant —
  // but it stays a visible, changeable choice, because pointing an address at
  // the wrong site is both easy to do and confusing to undo.
  // A free address's "Connect a domain" names its own site (issue 927).
  const askedFor = typeof ctx.params.propertyId === 'string' ? ctx.params.propertyId : null;
  const fallbackSite = askedFor ?? currentSiteId ?? '';
  const chosenSite = propertyId || fallbackSite;

  const siteItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const site of sites ?? []) items[site.id] = site.name;
    return items;
  }, [sites]);

  const trimmed = host.trim();
  useDirtySource(
    trimmed !== '' && !connect.isSuccess,
    'This domain has not been connected yet. Close anyway?'
  );

  const submit = () => {
    if (trimmed === '' || chosenSite === '') return;
    connect.mutate(
      { propertyId: chosenSite, host: trimmed },
      {
        onSuccess: (domain) => {
          // Becomes the setup view for the address that now exists — the DNS
          // records are the next thing needed, and they live on that pane. The
          // toast follows the pane swap rather than sharing its commit; see
          // `afterPaneChange`.
          ctx.open('platform.settings.domain', { id: domain.id }, { target: 'replace' });
          afterPaneChange(() => {
            toast.add({
              title: `${domain.host} added`,
              description: 'Now add the records shown to your domain provider.',
              type: 'success',
            });
          });
        },
      }
    );
  };

  const failure = connect.isError
    ? domainErrorMessage(connect.error, 'Could not connect that domain. Nothing was changed.')
    : null;

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Connect a domain actions"
        primary={
          <Button
            color="module"
            size="sm"
            className="ml-auto"
            loading={connect.isPending}
            disabled={trimmed === '' || chosenSite === ''}
            onClick={submit}
          >
            <Link2 className="size-4" aria-hidden />
            Connect
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <div className="flex flex-col gap-1">
            <Heading level={1} className="text-2xl font-semibold">
              Connect a domain you own
            </Heading>
            <Text>
              Point an address you already bought at one of your sites. It keeps working wherever it
              is now until you finish, and your site stays up throughout.
            </Text>
          </div>

          <SaveFailure title="Could not connect that domain" message={failure} />

          <FormSection title="The domain">
            <Field>
              <FieldLabel>Domain</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    value={host}
                    placeholder="yourbusiness.com"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) => {
                      setHost(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') submit();
                    }}
                  />
                }
              />
              <FieldDescription>
                Just the address itself: no https:// and no trailing slash. A sub-address like
                shop.yourbusiness.com works too.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Which site should it open?</FieldLabel>
              <Select
                color="module"
                items={siteItems}
                value={chosenSite}
                aria-label="Which site this address opens"
                onValueChange={(next) => {
                  setPropertyId(next as string);
                }}
              />
              <FieldDescription>Anyone typing this address lands on this site.</FieldDescription>
            </Field>
          </FormSection>

          <FormSection title="What happens after this">
            <Text className="text-sm">
              We give you a short record (sometimes two) to add at your domain provider, meaning the
              company you bought the domain from. Once they are in, press Check now and the address
              goes live, secure padlock and all.
            </Text>
          </FormSection>
        </div>
      </div>
    </div>
  );
}

/**
 * The free address that came with the site (persona issue 927).
 *
 * This read "Nothing to set up" and nothing else, which answers a question nobody
 * opening it has. Somebody looking at their free address wants to know where it
 * came from, whether it can change, which address customers are actually sent,
 * and how to get a proper one. So: those.
 *
 * Where it came from is told from the HOST, not from the business name. Older
 * businesses were given a made-up name (issue 010), so "made from your business's
 * name" would be false for exactly the people most likely to wonder.
 */
function FreeAddress({
  ctx,
  domain,
  siblings,
}: {
  ctx: SurfaceContext;
  domain: Domain;
  /** Every address of this site, this one included. */
  siblings: Domain[];
}) {
  const product = productName();
  // `<business>.<zone>` for the first site, `<site>.<business>.<zone>` after it.
  const labels = domain.host.split('.');
  const sitePart = labels.length >= 4 ? labels[0] : null;
  const main = siblings.find((other) => other.isCanonical && other.id !== domain.id);
  const hasOwnDomain = siblings.some((other) => other.type !== 'subdomain');

  return (
    <>
      <FormSection title="Where this address comes from">
        <Text className="text-sm">
          {sitePart
            ? `${product} gave this site its address when it was added. The first part, ${sitePart}, is the site's own; the rest is your business's.`
            : `${product} gave your business this address when you signed up.`}{' '}
          It never changes and cannot be removed, so a link to it keeps working for as long as the
          site exists.
        </Text>
        {main ? (
          <Text className="text-sm">
            This site&apos;s main address is <span className="font-semibold">{main.host}</span>.
            That is the one in the links your customers are sent and in your sitemap. This one opens
            the same site.
          </Text>
        ) : null}
      </FormSection>

      {hasOwnDomain ? null : (
        <FormSection
          title="Use your own domain"
          action={
            <Button
              size="sm"
              color="module"
              onClick={() => {
                ctx.open('platform.settings.domain', { id: 'new', propertyId: domain.propertyId });
              }}
            >
              <Link2 className="size-4" aria-hidden />
              Connect a domain
            </Button>
          }
        >
          <Text className="text-sm">
            If you own an address like yourbusiness.com, you can point it at this site.{' '}
            {domain.host} keeps working beside it, so nothing goes dark while you set it up.
          </Text>
        </FormSection>
      )}
    </>
  );
}

function ManageDomain({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data: domain, isPending, isError, error, refetch } = useDomain(id);
  const { data: sites } = useSites();
  const { data: allDomains } = useDomains();

  const verify = useVerifyDomain(id);
  const reissue = useReissueVerification(id);
  const canonical = useMakeCanonical(id);
  const disconnect = useDisconnectDomain(id);

  useEffect(() => {
    if (domain) ctx.setTitle(domain.host);
  }, [ctx, domain]);

  if (isError) {
    return (
      <PaneLoadError
        error={error}
        noun="address"
        title="Could not load this address"
        description="This is a problem reaching the server. The address itself is unaffected."
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  if (isPending || !domain) {
    return (
      <p className="p-4 text-sm" role="status">
        Loading…
      </p>
    );
  }

  const state = domainState(domain);
  const site = sites?.find((candidate) => candidate.id === domain.propertyId);
  const isLive = state.tone === 'success';
  const isManaged = domain.type === 'subdomain';

  const kindLabel =
    domain.type === 'subdomain'
      ? 'Included with your site'
      : domain.type === 'purchased'
        ? 'Bought through sparx'
        : 'Your own domain';

  const onCheck = () => {
    verify.mutate(undefined, {
      onSuccess: () => {
        toast.add({
          title: `${domain.host} is live`,
          description: 'Visitors can reach your site at this address now.',
          type: 'success',
        });
      },
      // A failure names the exact record that was missing, and that sentence is
      // shown in the page rather than a toast that vanishes mid-read.
    });
  };

  const onMakeCanonical = async () => {
    const ok = await confirm({
      title: `Make ${domain.host} the main address?`,
      description: `The links your customers are sent, and your sitemap, will use ${domain.host} from now on. The address used now keeps opening your site too, so links people already have still work.`,
      confirmLabel: 'Make it the main address',
      cancelLabel: 'Leave it as it is',
      color: 'warning',
    });
    if (!ok) return;
    canonical.mutate(undefined, {
      onSuccess: () => {
        toast.add({ title: `${domain.host} is now the main address`, type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not change the main address',
          description: domainErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const onDisconnect = async () => {
    const ok = await confirm({
      title: `Disconnect ${domain.host}?`,
      description: domain.isCanonical
        ? `This is your site's main address. Disconnecting it means anyone typing ${domain.host} will no longer reach you, and your site falls back to its sparx.zone address. You keep the domain itself. This only stops it pointing here.`
        : `Anyone typing ${domain.host} will no longer reach your site. You keep the domain itself. This only stops it pointing here, and you can connect it again later.`,
      confirmLabel: 'Disconnect it',
      cancelLabel: 'Keep it connected',
      color: 'danger',
    });
    if (!ok) return;
    disconnect.mutate(undefined, {
      onSuccess: () => {
        ctx.close();
        afterPaneChange(() => {
          toast.add({ title: `${domain.host} disconnected`, type: 'success' });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not disconnect that address',
          description: domainErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const checkFailure = verify.isError
    ? domainErrorMessage(
        verify.error,
        'We could not check the records just now. Try again shortly.'
      )
    : null;

  return (
    <div className={PANE_SHELL}>
      {/* `wrap` because this bar carries a variable number of lifecycle actions
          — Visit, Check now, Make main address, Disconnect — and which of them
          appear depends on the domain's state. There is no fixed set to reduce. */}
      <PaneToolbar
        label="Web address actions"
        controls={
          <>
            <Badge color={state.tone} variant="soft" size="sm">
              {state.label}
            </Badge>
            {domain.isCanonical ? (
              <Badge color="module" variant="soft" size="sm">
                Main address
              </Badge>
            ) : null}
            <div className="flex-1" />
            {isLive ? (
              <Button
                size="sm"
                variant="outline"
                // Empty here, not at runtime — silica's `render` moves this Button's
                // children onto the anchor, which the a11y rule cannot see.
                // eslint-disable-next-line jsx-a11y/anchor-has-content -- children arrive via `render`
                render={<a href={`https://${domain.host}`} target="_blank" rel="noreferrer" />}
              >
                Visit
                <ExternalLink className="size-3" aria-hidden />
              </Button>
            ) : null}
            {isManaged ? null : (
              <>
                {isLive ? null : (
                  <Button size="sm" color="module" loading={verify.isPending} onClick={onCheck}>
                    <RefreshCw className="size-4" aria-hidden />
                    Check now
                  </Button>
                )}
                {isLive && !domain.isCanonical ? (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={canonical.isPending}
                    onClick={() => {
                      void onMakeCanonical();
                    }}
                  >
                    <Star className="size-4" aria-hidden />
                    Make main address
                  </Button>
                ) : null}
              </>
            )}
          </>
        }
        /* A VALUE, not bespoke JSX: `controls` relocates into the narrow bar's
           overflow popover verbatim, so this was a bare red bin under "Visit"
           and "Make main address". scripts/check-toolbar-glyph.mjs holds the
           line. */
        actions={
          isManaged
            ? undefined
            : [
                {
                  label: 'Disconnect',
                  title: 'Disconnect this address',
                  icon: Trash2,
                  tone: 'danger' as const,
                  loading: disconnect.isPending,
                  onClick: () => {
                    void onDisconnect();
                  },
                },
              ]
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {/* The address IS the identity of this pane, and it is read-only — so
              it gets a real heading, with the two facts about it on one quiet
              line underneath rather than in a card of their own. */}
          <div className="flex flex-col gap-1">
            <Heading level={1} className="font-mono text-2xl font-semibold break-all">
              {domain.host}
            </Heading>
            <Text className="text-sm">
              {kindLabel} · Opens {site?.name ?? 'a site on this account'}
              {domain.expiresAt
                ? ` · Renews ${new Date(domain.expiresAt).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}`
                : ''}
            </Text>
          </div>

          {/* ONE status message, carrying the most specific true thing known. A
              failed check names the exact record that was missing, which beats
              the generic description of the same state — showing both stacked
              two paragraphs of "we could not find your records".
              Not on a working free address: the badge already says it, and the
              section below says what it is (issue 927). */}
          {isManaged && isLive ? null : (
            <Alert color={state.tone} variant="soft">
              <AlertContent>
                <AlertTitle>{state.label}</AlertTitle>
                <AlertDescription>{checkFailure ?? state.detail}</AlertDescription>
              </AlertContent>
            </Alert>
          )}

          {domain.instructions ? (
            <>
              <FormSection
                title="Records to add at your domain provider"
                description="Your domain provider is whoever you bought the domain from: GoDaddy, Namecheap, Cloudflare and so on. Find the DNS or Records screen there and add these exactly as shown."
              >
                <RecordBlock
                  kind="CNAME"
                  purpose="Sends visitors to your site"
                  record={domain.instructions.cname}
                />
                {domain.instructions.txt ? (
                  <RecordBlock
                    kind="TXT"
                    purpose="Proves the domain belongs to you"
                    record={domain.instructions.txt}
                  />
                ) : null}

                {/* A CNAME at the top level of a domain is not something every
                    provider supports, and the ones that do call it something
                    else. Saying so here saves the support conversation. */}
                {domain.verifiesByTxt ? (
                  <Text className="text-sm">
                    Some providers will not accept a CNAME for the top level of a domain. If yours
                    refuses, look for a record type called ALIAS, ANAME or “CNAME flattening” and
                    use that with the same values.
                  </Text>
                ) : null}

                <Text className="text-sm">
                  Changes at a domain provider take a few minutes to spread across the internet:
                  occasionally up to a few hours. If Check now does not find them straight away, it
                  is worth waiting and trying again before changing anything.
                </Text>
              </FormSection>

              {/* The TXT token is spent when it verifies, so a live apex domain
                  shows no TXT block above. Someone asked to re-prove ownership
                  would otherwise have nothing to enter. */}
              {domain.verifiesByTxt && !domain.instructions.txt ? (
                <FormSection
                  title="Proof of ownership"
                  description="This address is already verified, so its one-time proof record has been used up and removed."
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      loading={reissue.isPending}
                      onClick={() => {
                        reissue.mutate(undefined, {
                          onSuccess: () => {
                            toast.add({
                              title: 'New proof record issued',
                              description: 'Add the TXT record shown above, then press Check now.',
                              type: 'success',
                            });
                          },
                          onError: (error) => {
                            toast.add({
                              title: 'Could not issue a new record',
                              description: domainErrorMessage(error, 'Nothing was changed.'),
                              type: 'error',
                            });
                          },
                        });
                      }}
                    >
                      Issue a new one
                    </Button>
                  }
                >
                  <Text className="text-sm">
                    You only need this if you are asked to prove ownership again. Issuing a new
                    record does not interrupt anything: the address keeps working throughout.
                  </Text>
                </FormSection>
              ) : null}
            </>
          ) : (
            <FreeAddress
              ctx={ctx}
              domain={domain}
              siblings={(allDomains ?? []).filter(
                (other) => other.propertyId === domain.propertyId
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function DomainDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  return id === 'new' ? <ConnectDomain ctx={ctx} /> : <ManageDomain ctx={ctx} id={id} />;
}
