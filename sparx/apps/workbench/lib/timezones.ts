// The IANA time zone list, described in words a person recognises.
//
// A time zone is not free text: everything downstream (document dates, "due
// today", scheduling) formats through `Intl`, which accepts ONLY canonical IANA
// identifiers. "Mountain Time" or "MST" typed by hand throws at format time, so
// the picker is the validation — the list comes from the same runtime that will
// later consume the value.
//
// Labels lead with the CITY, not the identifier, because "America/Denver" is
// jargon and our users are not developers. The identifier stays the stored
// value; nobody has to read it.

export interface TimezoneOption {
  /** Canonical IANA identifier — what gets stored. */
  value: string;
  /** "Denver — Mountain Daylight Time (GMT-06:00)" */
  label: string;
  /** Minutes east of UTC, for ordering. */
  offsetMinutes: number;
  /** A big city sharing another city's zone (CITY_ALIASES). Sorted after the real
   *  entries, so finding an option by its stored zone returns the real one. */
  alias?: true;
}

function partOf(zone: string, style: 'long' | 'longOffset', at: Date): string | undefined {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: style })
      .formatToParts(at)
      .find((part) => part.type === 'timeZoneName')?.value;
  } catch {
    // A zone the runtime lists but cannot format is not usable — the caller
    // drops it rather than offering a choice that breaks on save.
    return undefined;
  }
}

/** "GMT-06:00" → -360. Plain "GMT" (UTC itself) has no digits and means zero. */
function offsetToMinutes(offset: string): number {
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(offset);
  if (!match) return 0;
  const [, sign, hours, minutes] = match;
  const total = Number(hours) * 60 + Number(minutes);
  return sign === '-' ? -total : total;
}

/** "America/Argentina/Buenos_Aires" → "Buenos Aires". */
function cityOf(zone: string): string {
  return (zone.split('/').pop() ?? zone).replace(/_/g, ' ');
}

function describe(zone: string, at: Date, city = cityOf(zone)): TimezoneOption | null {
  const offset = partOf(zone, 'longOffset', at);
  if (offset === undefined) return null;
  const name = partOf(zone, 'long', at);
  // `name` is the seasonal name ("Mountain Daylight Time") — genuinely the most
  // recognisable part. When the runtime has none it falls back to the offset
  // alone rather than printing an empty gap.
  const label = name && name !== city ? `${city}, ${name} (${offset})` : `${city} (${offset})`;
  return { value: zone, label, offsetMinutes: offsetToMinutes(offset) };
}

/**
 * Big cities that share a zone named after another city. The picker says "Search for
 * your city", and the IANA list names one city per zone, so an owner in Salt Lake
 * City, Dallas or Seattle typed their city and got "No time zone matches that city"
 * (sparx persona issue 027). Each becomes its own item that saves the shared zone.
 */
const CITY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  'America/New_York': [
    'Atlanta',
    'Baltimore',
    'Boston',
    'Charlotte',
    'Cleveland',
    'Columbus',
    'Jacksonville',
    'Miami',
    'Orlando',
    'Philadelphia',
    'Pittsburgh',
    'Raleigh',
    'Richmond',
    'Tampa',
    'Washington, DC',
  ],
  'America/Chicago': [
    'Austin',
    'Dallas',
    'Fort Worth',
    'Houston',
    'Kansas City',
    'Memphis',
    'Milwaukee',
    'Minneapolis',
    'Nashville',
    'New Orleans',
    'Oklahoma City',
    'Omaha',
    'San Antonio',
    'St. Louis',
  ],
  'America/Denver': [
    'Albuquerque',
    'Billings',
    'Cheyenne',
    'Colorado Springs',
    'El Paso',
    'Salt Lake City',
  ],
  'America/Phoenix': ['Mesa', 'Scottsdale', 'Tucson'],
  'America/Los_Angeles': [
    'Las Vegas',
    'Oakland',
    'Portland',
    'Reno',
    'Sacramento',
    'San Diego',
    'San Francisco',
    'San Jose',
    'Seattle',
  ],
  'America/Toronto': ['Ottawa', 'Quebec City'],
  'America/Edmonton': ['Calgary'],
  'America/Vancouver': ['Victoria'],
  'Europe/London': ['Birmingham', 'Edinburgh', 'Glasgow', 'Manchester'],
};

/**
 * Every time zone this runtime can format, ordered west to east.
 *
 * Offset order (rather than alphabetical) puts neighbours together, which is how
 * someone scans for one they half-remember. `current` is appended when it is not
 * in the list, so opening a record saved with a zone this runtime doesn't know
 * shows that zone rather than silently blanking the field and saving the loss.
 */
export function timezoneOptions(current?: string | null): TimezoneOption[] {
  const at = new Date();
  const supported =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : // Pre-2021 runtimes lack the enumeration. Rather than ship a stale copy
        // of the IANA database that silently rots, offer the browser's own zone
        // — the overwhelmingly likely answer — and let the rest be typed-in
        // values preserved by the `current` branch below.
        [Intl.DateTimeFormat().resolvedOptions().timeZone];

  const named = supported.map((zone) => describe(zone, at));
  const aliased = supported.flatMap((zone) =>
    (CITY_ALIASES[zone] ?? []).map((city) => {
      const option = describe(zone, at, city);
      return option ? { ...option, alias: true as const } : null;
    })
  );
  const options = [...named, ...aliased]
    .filter((option): option is TimezoneOption => option !== null)
    .sort(
      (a, b) =>
        a.offsetMinutes - b.offsetMinutes ||
        Number(Boolean(a.alias)) - Number(Boolean(b.alias)) ||
        a.label.localeCompare(b.label)
    );

  if (current && !options.some((option) => option.value === current)) {
    options.push({ value: current, label: current, offsetMinutes: 0 });
  }
  return options;
}
