import { SignJWT } from 'jose';

const SECRET = 'dev-only-internal-jwt-secret-change-me-32chars';
const TID = 'b44414a0-21b6-4d75-8d4e-59ea161d3826';
const UID = '6321a400-0219-4930-83d9-04b40f25dbb2';
const PROP_PERSONAL = 'e5c5bd19-3f21-4e6c-9cd6-36036bfed59d';

const now = Math.floor(Date.now() / 1000);
const token = await new SignJWT({ tid: TID, role: 'owner' })
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .setSubject(UID)
  .setIssuedAt(now)
  .setExpirationTime(now + 300)
  .sign(new TextEncoder().encode(SECRET));

const res = await fetch('http://localhost:3100/v1/blueprints/retail-store-blog/install', {
  method: 'POST',
  headers: {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'x-sparx-property-id': PROP_PERSONAL,
  },
});
console.log('HTTP', res.status);
console.log(await res.text());
