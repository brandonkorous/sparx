// sparx.market service barrel (docs/106 §4.7). One namespace exposing every market
// surface — projection, merchant profile/payout, product opt-in, public browse, and
// settlement — symmetric with the other commerce services (`marketService.*`).

export * from './commission';
export * from './projection';
export * from './merchant';
export * from './listings';
export * from './browse';
export * from './settlement';
export * from './payout';
