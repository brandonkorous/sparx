'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Label,
  NativeSelect,
  Switch,
  Textarea,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';
import {
  ModuleProvider,
  SurfaceFrame,
  SurfaceStep,
  SurfaceSummary,
  SurfaceSummaryDivider,
  SurfaceSummaryRow,
  statusLabel,
  statusTone,
  type SurfaceStepDef,
} from '@sparx/ui';
import { KNOWN_SPECIALTIES } from '@sparx/partner-schemas';

import { useUnsavedGuard } from '../../../_components/unsaved-guard';
import { PARTNER_KINDS } from '../../_lib/kinds';
import { fmtDate } from '../../_lib/format';
import { TIERS } from '../../_lib/tiers';
import type { PartnerProfile } from '../../_lib/types';
import { updatePartnerProfileAction } from '../actions';

// The public directory profile editor (docs/114 §B.7) — a single-module working
// surface, so it's the standard `embedded` SurfaceFrame edit pattern with neutral
// cards; identity rides the chrome + the violet Save button. The live summary
// aside shows the read-only facts (tier, referral code, directory URL) the partner
// can't edit here. Explicit-save, last-write-wins, with the unsaved-changes guard.

const STEPS: SurfaceStepDef[] = [{ key: 'profile', label: 'Profile' }];

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const bs = new Set(b);
  return a.every((x) => bs.has(x));
}

export function PartnerProfileEditForm({ profile }: { profile: PartnerProfile }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);

  const [displayName, setDisplayName] = React.useState(profile.displayName);
  const [bio, setBio] = React.useState(profile.bio ?? '');
  const [websiteUrl, setWebsiteUrl] = React.useState(profile.websiteUrl ?? '');
  const [kind, setKind] = React.useState(profile.kind);
  const [city, setCity] = React.useState(profile.locationCity ?? '');
  const [state, setState] = React.useState(profile.locationState ?? '');
  const [country, setCountry] = React.useState(profile.locationCountry ?? '');
  const [isRemote, setIsRemote] = React.useState(profile.isRemote);
  const [specialties, setSpecialties] = React.useState<string[]>(profile.specialties);
  const [photoUrl, setPhotoUrl] = React.useState(profile.photoUrl ?? '');
  const [directoryVisible, setDirectoryVisible] = React.useState(profile.directoryVisible);

  // Client rule: a practice name is required. The server can additionally reject
  // bio / website / photo URLs, which map back onto those fields.
  const v = useFieldValidation(
    { displayName, bio, websiteUrl, photoUrl },
    { displayName: rule.required('A practice name is required.') }
  );

  const dirty =
    displayName !== profile.displayName ||
    bio !== (profile.bio ?? '') ||
    websiteUrl !== (profile.websiteUrl ?? '') ||
    kind !== profile.kind ||
    city !== (profile.locationCity ?? '') ||
    state !== (profile.locationState ?? '') ||
    country !== (profile.locationCountry ?? '') ||
    isRemote !== profile.isRemote ||
    photoUrl !== (profile.photoUrl ?? '') ||
    directoryVisible !== profile.directoryVisible ||
    !sameSet(specialties, profile.specialties);

  React.useEffect(() => {
    if (dirty) setSavedAt(null);
  }, [dirty]);

  const guardLeave = useUnsavedGuard(dirty, { kind: 'edit', noun: 'profile' });
  const cancel = React.useCallback(async () => {
    if (!(await guardLeave())) return;
    router.push('/partner');
  }, [guardLeave, router]);

  function toggleSpecialty(tag: string) {
    setSpecialties((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function submit() {
    setError(null);
    if (!v.validate()) return;
    const payload = {
      displayName: displayName.trim(),
      bio: bio.trim() || null,
      websiteUrl: websiteUrl.trim() || null,
      kind,
      locationCity: city.trim() || null,
      locationState: state.trim() || null,
      locationCountry: country.trim() ? country.trim().toUpperCase() : null,
      isRemote,
      specialties,
      photoUrl: photoUrl.trim() || null,
      directoryVisible,
    };
    startTransition(async () => {
      const result = await updatePartnerProfileAction(payload);
      if (!result.ok) {
        if (result.fieldErrors?.length) {
          const fe: Record<string, string> = {};
          for (const f of result.fieldErrors) fe[f.field] = f.message;
          v.setServerErrors(fe);
        }
        setError(result.error ?? 'Could not save your profile.');
        return;
      }
      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    });
  }

  return (
    <ModuleProvider module="partner" className="h-full">
      <SurfaceFrame
        variant="embedded"
        title="Directory profile"
        backLabel="Profile"
        steps={STEPS}
        current={0}
        onCancel={cancel}
        summary={<ProfileSummary profile={profile} directoryVisible={directoryVisible} />}
      >
        <SurfaceStep
          header={{
            title: 'Your public listing',
            supporting:
              'This is how you appear in the sparx.works partner directory. Turn visibility off to keep earning while staying unlisted.',
          }}
          actions={{
            nextForm: 'partner-profile-form',
            nextLabel: 'Save changes',
            nextLoading: pending,
            nextDisabled: pending || !dirty,
            extra:
              savedAt && !error ? (
                <p className="text-success text-xs">Saved {savedAt}</p>
              ) : undefined,
          }}
        >
          <form
            id="partner-profile-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (pending || !dirty) return;
              submit();
            }}
          >
            <Card>
              <CardBody>
                <div className="flex flex-col gap-5">
                  <Field {...v.field('displayName')}>
                    <FieldLabel required>Practice name</FieldLabel>
                    <FieldControl
                      id="p-name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={255}
                      {...v.control('displayName')}
                    />
                  </Field>

                  <Field {...v.field('bio')}>
                    <FieldLabel>Bio</FieldLabel>
                    <FieldControl
                      id="p-bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      maxLength={2000}
                      placeholder="What you do, who you help, and what makes your practice a good fit."
                      {...v.control('bio')}
                      render={<Textarea rows={4} />}
                    />
                  </Field>

                  <div className="flex flex-row flex-wrap gap-3">
                    <Field {...v.field('websiteUrl')} className="min-w-[14rem] flex-1">
                      <FieldLabel>Website</FieldLabel>
                      <FieldControl
                        id="p-website"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        placeholder="https://example.com"
                        {...v.control('websiteUrl')}
                      />
                    </Field>
                    <Field className="min-w-[14rem] flex-1">
                      <FieldLabel>What describes you</FieldLabel>
                      <FieldControl
                        id="p-kind"
                        value={kind}
                        onChange={(e) => setKind(e.target.value as PartnerProfile['kind'])}
                        render={
                          <NativeSelect>
                            {PARTNER_KINDS.map((k) => (
                              <option key={k.value} value={k.value}>
                                {k.label}
                              </option>
                            ))}
                          </NativeSelect>
                        }
                      />
                    </Field>
                  </div>

                  <Field {...v.field('photoUrl')}>
                    <FieldLabel>Logo / photo URL</FieldLabel>
                    <FieldControl
                      id="p-photo"
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      placeholder="https://…/logo.png"
                      {...v.control('photoUrl')}
                    />
                  </Field>

                  <div className="flex flex-row flex-wrap gap-3">
                    <Field className="min-w-[10rem] flex-1">
                      <FieldLabel>City</FieldLabel>
                      <FieldControl
                        id="p-city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </Field>
                    <Field className="min-w-[10rem] flex-1">
                      <FieldLabel>State / region</FieldLabel>
                      <FieldControl
                        id="p-state"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                      />
                    </Field>
                    <Field className="w-28">
                      <FieldLabel>Country</FieldLabel>
                      <FieldControl
                        id="p-country"
                        value={country}
                        onChange={(e) => setCountry(e.target.value.toUpperCase())}
                        placeholder="US"
                        maxLength={2}
                        className="uppercase"
                      />
                    </Field>
                  </div>

                  <Toggle
                    id="p-remote"
                    label="Work remotely"
                    hint="Show that you take on clients anywhere, not just your city."
                    checked={isRemote}
                    onCheckedChange={setIsRemote}
                  />

                  <div className="flex flex-col gap-2">
                    <Label>Specialties</Label>
                    <p className="text-base-content/70 text-xs">
                      The areas you focus on — these drive the directory’s specialty filter.
                    </p>
                    <div className="flex flex-row flex-wrap gap-2">
                      {KNOWN_SPECIALTIES.map((tag) => {
                        const on = specialties.includes(tag);
                        return (
                          <Button
                            key={tag}
                            type="button"
                            size="sm"
                            color="module"
                            variant={on ? 'soft' : 'outline'}
                            onClick={() => toggleSpecialty(tag)}
                            aria-pressed={on}
                          >
                            {tag}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <SurfaceSummaryDivider />

                  <Toggle
                    id="p-visible"
                    label="List me in the public directory"
                    hint="When off, you stay an active partner and keep earning — you just won’t appear in the directory."
                    checked={directoryVisible}
                    onCheckedChange={setDirectoryVisible}
                  />
                </div>
              </CardBody>
            </Card>
          </form>
          {error && (
            <FieldStatus
              status="error"
              attached={false}
              role="alert"
              aria-live="polite"
              className="mt-4"
            >
              {error}
            </FieldStatus>
          )}
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}

function Toggle({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-row items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-base-content/70 text-xs">{hint}</p>
      </div>
      <Switch id={id} color="module" checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function ProfileSummary({
  profile,
  directoryVisible,
}: {
  profile: PartnerProfile;
  directoryVisible: boolean;
}) {
  const tier = TIERS[profile.tier];
  return (
    <SurfaceSummary
      title="Partner"
      footer={
        <Badge color={directoryVisible ? statusTone('active') : 'neutral'} variant="soft">
          {directoryVisible ? 'Listed publicly' : 'Unlisted'}
        </Badge>
      }
    >
      <SurfaceSummaryRow label="Tier" value={tier.label} />
      <SurfaceSummaryRow
        label="Status"
        value={
          <Badge color={statusTone(profile.status)} variant="soft" size="sm">
            {statusLabel(profile.status)}
          </Badge>
        }
      />
      <SurfaceSummaryRow label="Referral code" value={profile.referralCode} />
      <SurfaceSummaryDivider />
      <SurfaceSummaryRow label="Member since" value={fmtDate(profile.createdAt) ?? '—'} />
      <SurfaceSummaryRow label="Commission" value={tier.commission} />
    </SurfaceSummary>
  );
}
