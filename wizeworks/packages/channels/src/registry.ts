// Channel adapter registry. Concrete adapters register at worker boot; the
// channel-sync-worker reads from this registry to dispatch a job to the right
// adapter by slug. Mirrors the integration-framework provider registry.
//
// Adapter packages (or modules) call `registerChannel(new TikTokShopAdapter())`
// at startup — adding a channel is one adapter + one registration line, with no
// change to the worker's dispatch core (docs/106 §4.1).

import type { ChannelAdapter, ChannelShape, ChannelSlug } from './types.js';

class ChannelRegistry {
  private readonly bySlug = new Map<ChannelSlug, ChannelAdapter>();

  register(adapter: ChannelAdapter): void {
    if (this.bySlug.has(adapter.id)) {
      throw new Error(`Channel already registered: ${adapter.id}`);
    }
    this.bySlug.set(adapter.id, adapter);
  }

  /** Test-only: swap in a stub adapter. */
  unregister(slug: ChannelSlug): void {
    this.bySlug.delete(slug);
  }

  get(slug: ChannelSlug): ChannelAdapter | undefined {
    return this.bySlug.get(slug);
  }

  has(slug: ChannelSlug): boolean {
    return this.bySlug.has(slug);
  }

  list(filter: { shape?: ChannelShape } = {}): ChannelAdapter[] {
    const all = [...this.bySlug.values()];
    if (!filter.shape) return all;
    return all.filter((a) => a.shape === filter.shape);
  }

  reset(): void {
    this.bySlug.clear();
  }
}

const singleton = new ChannelRegistry();

export function registerChannel(adapter: ChannelAdapter): void {
  singleton.register(adapter);
}

export function unregisterChannel(slug: ChannelSlug): void {
  singleton.unregister(slug);
}

export function getChannel(slug: ChannelSlug): ChannelAdapter | undefined {
  return singleton.get(slug);
}

export function hasChannel(slug: ChannelSlug): boolean {
  return singleton.has(slug);
}

export function listChannels(filter: { shape?: ChannelShape } = {}): ChannelAdapter[] {
  return singleton.list(filter);
}

/** Test-only: wipe the registry between cases. */
export function _resetChannelRegistryForTest(): void {
  singleton.reset();
}
