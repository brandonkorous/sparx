'use client';

import * as React from 'react';

/**
 * Live device mockups for the favicon tool — the part that lets someone judge
 * the result before downloading. Browser tab, Google result, Android (using the
 * maskable icon in a squircle), and iOS home screen, all fed live data URLs.
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

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  padding: '16px',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-base-300)',
  backgroundColor: 'var(--color-base-100)',
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: '11px',
  fontWeight: 500,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
};

export function FaviconPreviews({
  small,
  apple,
  maskable,
  themeColor,
  name,
  domain,
}: FaviconPreviewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Browser tab */}
      <div style={cardStyle}>
        <span style={labelStyle}>Browser tab</span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            maxWidth: '260px',
            padding: '8px 12px',
            borderRadius: '8px 8px 0 0',
            borderTop: `2px solid ${themeColor}`,
            backgroundColor: 'var(--color-base-200)',
            border: '1px solid var(--color-base-300)',
          }}
        >
          <img src={small} alt="" width={16} height={16} style={{ flexShrink: 0 }} />
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '12.5px',
              color: 'var(--color-base-content)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {name}
          </span>
          <span
            style={{
              marginLeft: 'auto',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              fontSize: '14px',
            }}
          >
            ×
          </span>
        </div>
      </div>

      {/* Google result */}
      <div style={cardStyle}>
        <span style={labelStyle}>Search result</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '26px',
              height: '26px',
              borderRadius: '9999px',
              border: '1px solid var(--color-base-300)',
              backgroundColor: '#fff',
              flexShrink: 0,
            }}
          >
            <img src={small} alt="" width={16} height={16} />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3, minWidth: 0 }}>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                color: 'var(--color-base-content)',
              }}
            >
              {name}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              }}
            >
              {domain}
            </span>
          </div>
        </div>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', color: '#1a0dab' }}>
          {name} — official site
        </span>
      </div>

      {/* Home screens */}
      <div className="tool-fieldgrid">
        <HomeScreen label="Android" icon={maskable} name={name} radius="22%" />
        <HomeScreen label="iOS" icon={apple} name={name} radius="22.5%" />
      </div>
    </div>
  );
}

function HomeScreen({
  label,
  icon,
  name,
  radius,
}: {
  label: string;
  icon: string;
  name: string;
  radius: string;
}) {
  return (
    <div style={cardStyle}>
      <span style={labelStyle}>{label} home screen</span>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          padding: '20px',
          borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, #3b4a6b 0%, #1f2740 100%)',
        }}
      >
        <img
          src={icon}
          alt=""
          width={60}
          height={60}
          style={{ borderRadius: radius, boxShadow: '0 6px 16px rgba(0,0,0,0.35)' }}
        />
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '11px',
            color: '#fff',
            maxWidth: '90px',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
        </span>
      </div>
    </div>
  );
}
