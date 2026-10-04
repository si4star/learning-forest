// Password hashing (PBKDF2-SHA256 via WebCrypto) and session tokens.
//
// UPGRADE LATER: the default of 10,000 iterations keeps logins inside the Workers
// Free plan's 10 ms CPU limit (each hash costs ~1.8 ms; recovery does three).
// On Workers Paid, set the PBKDF2_ITERATIONS environment variable to 100000
// (the Workers maximum). Each hash records its own iteration count, so old
// hashes still verify and are re-hashed at the new strength on next login.
const DEFAULT_ITERATIONS = 10000, MAX_ITERATIONS = 100000;
let ITERATIONS = DEFAULT_ITERATIONS;

export function configure(env) {
  const n = Number(env.PBKDF2_ITERATIONS);
  ITERATIONS = Number.isInteger(n) && n >= DEFAULT_ITERATIONS ? Math.min(n, MAX_ITERATIONS) : DEFAULT_ITERATIONS;
}
const enc = new TextEncoder();

const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function derive(secret, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

export async function hashSecret(secret) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(await derive(secret, salt, ITERATIONS))}`;
}

// Used when the account doesn't exist, so a miss takes as long as a wrong password.
const dummy = () => `pbkdf2$${ITERATIONS}$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=`;

export const needsRehash = stored => Number(String(stored).split('$')[1]) < ITERATIONS;

export async function verifySecret(secret, stored) {
  const [alg, iter, salt, hash] = (stored || dummy()).split('$');
  if (alg !== 'pbkdf2') return false;
  const got = new Uint8Array(await derive(secret, unb64(salt), Number(iter)));
  const want = unb64(hash);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0 && !!stored;
}

export function newToken() {
  return b64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256(s) {
  return b64(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}
