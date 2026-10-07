// A QR encoder written from ISO/IEC 18004: a string in, a grid of booleans out.
// It knows nothing about canvases, colors or logos, so one encoder serves PNG, SVG
// and print output. The parts live in ./qr/; qr/tables.ts explains the design.

export { EC_LEVELS, type EcLevel } from './qr/tables';
export { encodeQr, type QrResult } from './qr/encode';
export { emailPayload, geoPayload, smsPayload, telPayload, wifiPayload } from './qr/payloads';
export {
  __formatBitsForTest,
  __planForTest,
  __versionBitsForTest,
  verifyCapacityTable,
} from './qr/self-check';
