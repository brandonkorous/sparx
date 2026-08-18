'use client';

import * as React from 'react';
import { Card, CardBody, MockupBrowser, MockupPhone } from '@wizeworks/silicaui-react';
import { Text } from '../primitives';

/**
 * Live device mockups for the favicon tool — the part that lets someone judge
 * the result before downloading. Browser tab, Google result, Android (using the
 * maskable icon in a squircle), and iOS home screen, all fed live data URLs.
 *
 * The browser and phone chrome are silica's `MockupBrowser` / `MockupPhone`; the
 * search-result row is bespoke because it deliberately imitates a specific
 * third-party result layout, which no design-system primitive expresses.
 */
export interface FaviconPreviewProps {
  /** Data URL of the 32px icon (used for tab + search result). */
  small: string;
  /** Data URL of the 180px apple-touch icon. */
  apple: string;
  /** Data URL of the 512px maskable icon. */
  maskable: string;
  themeColor: string;
  name: string;
  domain: string;
}

/** One labeled preview cell — caption above, mock below. */
function Preview({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardBody className="gap-2.5">
        <Text size={13}>{label}</Text>
        {children}
      </CardBody>
    </Card>
  );
}

export function FaviconPreviews({
  small,
  apple,
  maskable,
  themeColor,
  name,
  domain,
}: FaviconPreviewProps) {
  return (
    <div className="flex flex-col gap-3.5">
      <Preview label="Browser tab">
        <MockupBrowser
          toolbar={
            <div
              className="bg-base-100 border-base-300 flex max-w-[240px] min-w-0 flex-1 items-center gap-2 rounded-t-lg border border-b-0 px-3 py-1.5"
              // The tab's top edge takes the user's chosen theme color — the one
              // genuinely runtime-dynamic value in this mock.
              style={{ borderTop: `2px solid ${themeColor}` }}
            >
              <img src={small} alt="" width={16} height={16} className="flex-shrink-0" />
              <span className="min-w-0 truncate font-sans text-sm">{name}</span>
              <span aria-hidden className="ml-auto text-sm">
                ×
              </span>
            </div>
          }
        >
          <div className="px-4 py-5">
            <Text size={13}>{domain}</Text>
          </div>
        </MockupBrowser>
      </Preview>

      <Preview label="Search result">
        <div className="flex items-center gap-2.5">
          <span
            data-theme="light"
            className="border-base-300 bg-base-100 inline-flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full border"
          >
            <img src={small} alt="" width={16} height={16} />
          </span>
          <div className="flex min-w-0 flex-col">
            <Text size={12}>{name}</Text>
            <Text size={11}>{domain}</Text>
          </div>
        </div>
        <Text size={15} className="text-[#1a0dab]">
          {name} — official site
        </Text>
      </Preview>

      <div className="tool-fieldgrid">
        <HomeScreen label="Android" icon={maskable} name={name} iconClassName="rounded-[22%]" />
        <HomeScreen label="iOS" icon={apple} name={name} iconClassName="rounded-[22.5%]" />
      </div>
    </div>
  );
}

function HomeScreen({
  label,
  icon,
  name,
  iconClassName,
}: {
  label: string;
  icon: string;
  name: string;
  iconClassName: string;
}) {
  return (
    <Preview label={`${label} home screen`}>
      {/* The stock display is 15rem wide — too wide for two side-by-side inside
          the output pane, so the sizing (not the skin) is overridden here. */}
      <MockupPhone className="mx-auto [&_.mockup-phone-display]:w-40">
        <div className="bg-neutral text-neutral-content flex h-full flex-col items-center justify-center gap-2 p-4">
          <img src={icon} alt="" width={60} height={60} className={`shadow-lg ${iconClassName}`} />
          <span className="max-w-[90px] truncate text-center font-sans text-sm">{name}</span>
        </div>
      </MockupPhone>
    </Preview>
  );
}
