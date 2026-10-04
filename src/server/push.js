// Web Push with VAPID (RFC 8292). Reminders are sent with an empty body, so no payload
// encryption is needed: the service worker shows a fixed reminder when a push arrives.
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const VAPID_PUBLIC_KEY = 'BFXwFsqbBKnp3g-1oVvI3UoYA31muXHWVXfwVK-6fo6YkYhG7SiOZmTtv04UMQMbGR1JekoavPmquSnJv82b31Q';

export async function vapidAuth(endpoint, privateJwk, subject, publicKey = VAPID_PUBLIC_KEY) {
  const header = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const { kty, crv, x, y, d } = privateJwk;
  const key = await crypto.subtle.importKey('jwk', { kty, crv, x, y, d }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${publicKey}`;
}

export async function sendPush(endpoint, privateJwk, subject, publicKey = VAPID_PUBLIC_KEY) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: await vapidAuth(endpoint, privateJwk, subject, publicKey), TTL: '3600', Urgency: 'normal', 'Content-Length': '0' },
  });
  return res.status;
}
