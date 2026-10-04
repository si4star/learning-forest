// Password hashing (PBKDF2-SHA256 via WebCrypto) and session tokens.
// The iteration count is stored in each hash so it can be raised later.
const ITERATIONS = 100000; // Cloudflare Workers' maximum for PBKDF2
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
const DUMMY = `pbkdf2$${ITERATIONS}$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=`;

export async function verifySecret(secret, stored) {
  const [alg, iter, salt, hash] = (stored || DUMMY).split('$');
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
