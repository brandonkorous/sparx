import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { youtubeEmbed, mapEmbed } from '../utils/embed';
import { EmbedFrame } from './embed-frame';
import { Video } from './video';
import { Map } from './map';

describe('youtubeEmbed', () => {
  it('extracts the id from common YouTube URL shapes', () => {
    const expected = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0';
    expect(youtubeEmbed('https://youtu.be/dQw4w9WgXcQ')).toBe(expected);
    expect(youtubeEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(expected);
    expect(youtubeEmbed('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(expected);
    expect(youtubeEmbed('dQw4w9WgXcQ')).toBe(expected);
  });

  it('returns null for empty / unusable input', () => {
    expect(youtubeEmbed('')).toBeNull();
    expect(youtubeEmbed('   ')).toBeNull();
  });
});

describe('mapEmbed', () => {
  it('prefers an explicit embed URL', () => {
    expect(mapEmbed('Paris', 'https://maps.test/embed')).toBe('https://maps.test/embed');
  });

  it('builds a keyless maps embed from a query', () => {
    expect(mapEmbed('1 Main St', '')).toBe(
      'https://www.google.com/maps?q=1%20Main%20St&output=embed'
    );
  });

  it('returns null when neither is provided', () => {
    expect(mapEmbed('', '')).toBeNull();
  });
});

describe('EmbedFrame', () => {
  it('renders an iframe with the given src + ratio class', () => {
    const { container } = render(<EmbedFrame src="https://x.test/e" title="Clip" ratio="pano" />);
    expect(container.querySelector('.st-embed')).toHaveClass('st-embed--pano');
    const frame = screen.getByTitle('Clip');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame).toHaveAttribute('src', 'https://x.test/e');
  });

  it('renders a placeholder when there is no src', () => {
    render(<EmbedFrame title="Clip" placeholder="Add a link" />);
    expect(screen.getByText('Add a link')).toHaveClass('st-embed__placeholder');
  });
});

describe('Video', () => {
  it('derives a nocookie embed from a YouTube link', () => {
    render(<Video url="https://youtu.be/dQw4w9WgXcQ" title="Promo" />);
    expect(screen.getByTitle('Promo')).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0'
    );
  });

  it('shows the placeholder for an empty url', () => {
    render(<Video url="" />);
    expect(screen.getByText('Add a YouTube link')).toBeInTheDocument();
  });
});

describe('Map', () => {
  it('builds a maps embed from a query', () => {
    render(<Map query="Paris" title="HQ" />);
    expect(screen.getByTitle('HQ')).toHaveAttribute(
      'src',
      'https://www.google.com/maps?q=Paris&output=embed'
    );
  });
});
