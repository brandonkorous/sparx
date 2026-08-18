// Gateway registry (docs/94 ADR §4). Gateways register at startup; the payment
// service + webhook router resolve by id. One process-wide registry.

import type { PaymentGateway } from './gateway';

export class GatewayNotFoundError extends Error {
  constructor(gatewayId: string) {
    super(`Payment gateway not found: ${gatewayId}`);
    this.name = 'GatewayNotFoundError';
  }
}

class GatewayRegistry {
  private readonly gateways = new Map<string, PaymentGateway>();

  register(gateway: PaymentGateway): void {
    this.gateways.set(gateway.id, gateway);
  }

  get(gatewayId: string): PaymentGateway {
    const gateway = this.gateways.get(gatewayId);
    if (!gateway) throw new GatewayNotFoundError(gatewayId);
    return gateway;
  }

  has(gatewayId: string): boolean {
    return this.gateways.has(gatewayId);
  }

  list(): PaymentGateway[] {
    return Array.from(this.gateways.values());
  }
}

export const gatewayRegistry = new GatewayRegistry();

/** Register the built-in gateways. Called once at host boot. Idempotent. */
export function registerBuiltInGateways(gateways: readonly PaymentGateway[]): void {
  for (const g of gateways) gatewayRegistry.register(g);
}
