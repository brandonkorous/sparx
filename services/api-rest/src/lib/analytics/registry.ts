// The metric registry — one entry per addressable metric.
//
// Registration is a side effect of importing `metrics/index.ts`, the same way
// the workbench surface catalog registers surfaces: definitions live next to the
// service they delegate to, and the registry is just the lookup. Ids are a public
// contract (docs/129 §4), so a duplicate id is a programming error worth throwing
// on rather than silently letting the second win.

import type { MetricDefinition } from './types.js';

const registry = new Map<string, MetricDefinition>();

export function registerMetric(definition: MetricDefinition): void {
  if (registry.has(definition.id)) {
    throw new Error(
      `Metric "${definition.id}" is already registered. Metric ids are a permanent contract and must be unique.`
    );
  }
  registry.set(definition.id, definition);
}

export function registerMetrics(definitions: readonly MetricDefinition[]): void {
  for (const definition of definitions) registerMetric(definition);
}

export function getMetric(id: string): MetricDefinition | undefined {
  return registry.get(id);
}

export function listMetrics(): MetricDefinition[] {
  return [...registry.values()];
}
