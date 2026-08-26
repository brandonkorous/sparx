'use client';

import type { BackdropReading } from '../lib/favicon-backdrop';
import { ColorField, Panel, SelectField, TextField } from '../ui-kit';
import { Legibility } from './legibility';

export type Backdrop = 'see-through' | 'solid';

export interface FaviconSettings {
  backdrop: Backdrop;
  background: string;
  appName: string;
  themeColor: string;
}

const BEHIND_HINT: Record<Backdrop, string> = {
  solid: 'The color below is filled in behind your logo, on every icon in the set.',
  'see-through':
    'Your logo sits straight on whatever color the browser is using — which is white for some people and near-black for others. The home-screen icon is the exception: iPhones turn see-through pixels black, so that one is always filled with the color below.',
};

const COLOR_HINT: Record<Backdrop, string> = {
  solid: 'Filled behind your logo on all six icons — exactly this color, nothing adjusted.',
  'see-through':
    'iPhones turn transparency black, so the home-screen icon has to be solid. This is the color behind your logo there.',
};

export function SettingsPanel({
  settings,
  onChange,
  reading,
}: {
  settings: FaviconSettings;
  onChange: <K extends keyof FaviconSettings>(key: K, value: FaviconSettings[K]) => void;
  reading: BackdropReading | null;
}) {
  const { backdrop, background, appName, themeColor } = settings;

  return (
    <Panel title="The details" description="How the icons are put together.">
      <SelectField
        label="Behind your logo"
        hint={BEHIND_HINT[backdrop]}
        value={backdrop}
        onChange={(value) => onChange('backdrop', value)}
        options={[
          { value: 'see-through', label: 'See-through' },
          { value: 'solid', label: 'A solid color' },
        ]}
      />
      <ColorField
        label={backdrop === 'solid' ? 'Background color' : 'Background for the phone icon'}
        hint={COLOR_HINT[backdrop]}
        value={background}
        onChange={(value) => onChange('background', value)}
      />

      <Legibility reading={reading} backdrop={backdrop} background={background} />

      <TextField
        label="Your business name"
        hint="Shown under the icon when somebody saves your site to their home screen."
        value={appName}
        onChange={(value) => onChange('appName', value)}
      />
      <ColorField
        label="Browser color"
        hint="Tints the browser's own bar on a phone. Usually your main brand color."
        value={themeColor}
        onChange={(value) => onChange('themeColor', value)}
      />
    </Panel>
  );
}
